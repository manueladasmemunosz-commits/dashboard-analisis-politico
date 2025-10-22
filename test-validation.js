// Test script to validate the new intelligent validation
import fs from 'fs';

// Simulate the validation logic from dashboard.js
function loadCsvData(data) {
    console.log('📄 Cargando datos CSV:', data.length, 'registros totales');

    let stats = {
        withText: 0,
        withUser: 0,
        withDate: 0,
        withSource: 0,
        totallyEmpty: 0,
        valid: 0
    };

    const validData = data.filter(post => {
        const hasText = post.text && post.text.trim().length > 0;
        const hasUser = post.user_name && post.user_name.trim().length > 0;
        const hasDate = post.created && post.created.trim().length > 0;
        const hasSource = post.source && post.source.trim().length > 0;

        // Contadores
        if (hasText) stats.withText++;
        if (hasUser) stats.withUser++;
        if (hasDate) stats.withDate++;
        if (hasSource) stats.withSource++;

        // Solo filtrar registros COMPLETAMENTE vacíos
        const isCompletelyEmpty = !hasText && !hasUser && !hasDate && !hasSource;

        if (isCompletelyEmpty) {
            stats.totallyEmpty++;
            return false; // Filtrar solo los completamente vacíos
        } else {
            stats.valid++;
            return true; // Mantener todos los que tengan ALGO de información
        }
    });

    console.log(`📊 NUEVA VALIDACIÓN INTELIGENTE:
        - Total registros CSV: ${data.length}
        - Con texto: ${stats.withText}
        - Con usuario: ${stats.withUser}
        - Con fecha: ${stats.withDate}
        - Con source: ${stats.withSource}
        - Completamente vacíos (filtrados): ${stats.totallyEmpty}
        - Registros válidos (conservados): ${stats.valid}
        - Porcentaje conservado: ${((stats.valid / data.length) * 100).toFixed(1)}%
    `);

    console.log(`✅ Cargando ${stats.valid} registros con información útil`);
    return validData;
}

// Parse CSV
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i += 2;
            } else {
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }

    values.push(current.trim());
    return values;
}

// Load and test the sample data
try {
    const csv = fs.readFileSync('./static/sample-data.csv', 'utf8');
    const lines = csv.split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));

    const data = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
            const values = parseCSVLine(line).map(v => v.replace(/"/g, ''));
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            return obj;
        });

    console.log('Sample from CSV:');
    console.log(data.slice(0, 3));

    const validData = loadCsvData(data);
    console.log('\nFirst few valid records:');
    console.log(validData.slice(0, 3));

} catch (error) {
    console.error('Error:', error.message);
}