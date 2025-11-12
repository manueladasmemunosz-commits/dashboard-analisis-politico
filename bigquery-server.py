#!/usr/bin/env python3
"""
Servidor seguro para consultas BigQuery
Solo operaciones READ - Máxima precaución
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import bigquery
import os
import re

app = Flask(__name__)
CORS(app)

# Configurar credenciales
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'bigquery-credentials.json'
client = bigquery.Client()

def validate_query_security(query):
    """Validar que la query es segura - SOLO SELECT"""
    query_upper = query.upper().strip()

    # Lista de comandos prohibidos
    forbidden_commands = [
        'DELETE', 'DROP', 'TRUNCATE', 'UPDATE', 'INSERT',
        'ALTER', 'CREATE', 'MERGE', 'UPSERT'
    ]

    # Verificar comandos prohibidos
    for cmd in forbidden_commands:
        if cmd in query_upper:
            raise ValueError(f"Comando prohibido detectado: {cmd}")

    # Debe empezar con SELECT
    if not query_upper.startswith('SELECT'):
        raise ValueError("Solo consultas SELECT permitidas")

    # Validar que solo accede a la tabla autorizada
    if 'secom-359014.ProyectosTooldata.datav2' not in query:
        raise ValueError("Solo acceso a tabla autorizada")

@app.route('/query', methods=['POST'])
def execute_query():
    try:
        data = request.json
        search_term = data.get('search_term', '')
        start_date = data.get('start_date', '2025-08-01')

        # Construir query segura
        base_query = f"""
            SELECT * FROM `secom-359014.ProyectosTooldata.datav2`
            WHERE created >= '{start_date}'
        """

        if search_term:
            # Escapar caracteres especiales en search_term
            safe_search = search_term.replace("'", "''")
            base_query += f" AND (text LIKE '%{safe_search}%' OR name_proyecto LIKE '%{safe_search}%')"

        base_query += " ORDER BY created DESC LIMIT 1000"

        # VALIDAR QUERY ANTES DE EJECUTAR
        validate_query_security(base_query)

        print(f"✅ Query validada: {base_query}")

        # Ejecutar query
        query_job = client.query(base_query)
        results = query_job.result()

        # Convertir a lista de diccionarios
        data = []
        for row in results:
            data.append(dict(row))

        print(f"✅ Resultados obtenidos: {len(data)}")
        return jsonify({
            'success': True,
            'data': data,
            'count': len(data)
        })

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'message': 'BigQuery server running'})

if __name__ == '__main__':
    print("🚀 Iniciando servidor BigQuery seguro...")
    print("⚠️  SOLO OPERACIONES READ - Modo seguro activado")
    app.run(host='0.0.0.0', port=5000, debug=True)