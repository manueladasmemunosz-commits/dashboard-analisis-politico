// Script para analizar distribución de fechas en los datos
import fs from 'fs';

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

function analyzeDates(csvFile) {
    try {
        const csv = fs.readFileSync(csvFile, 'utf8');
        const lines = csv.split('\n');
        const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));

        console.log('📊 Headers encontrados:', headers);
        const createdIndex = headers.indexOf('created');

        if (createdIndex === -1) {
            console.error('❌ No se encontró columna "created"');
            return;
        }

        const dateDistribution = {};
        const corruptDates = [];
        const validDates = [];

        let totalRecords = 0;
        let withDate = 0;
        let withoutDate = 0;
        let validDateFormat = 0;
        let invalidDateFormat = 0;

        lines.slice(1).filter(line => line.trim()).forEach((line, index) => {
            totalRecords++;
            const values = parseCSVLine(line).map(v => v.replace(/"/g, ''));
            const rawDate = values[createdIndex] || '';

            if (!rawDate || rawDate.trim() === '') {
                withoutDate++;
                return;
            }

            withDate++;

            // Extraer solo la parte de fecha (antes del espacio si hay uno)
            const dateOnly = rawDate.split(' ')[0];

            // Verificar formato de fecha válido
            const isValidFormat = /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(dateOnly);

            if (isValidFormat) {
                validDateFormat++;
                const normalizedDate = dateOnly.replace(/\//g, '-');
                validDates.push(normalizedDate);

                // Contar distribución
                if (!dateDistribution[normalizedDate]) {
                    dateDistribution[normalizedDate] = 0;
                }
                dateDistribution[normalizedDate]++;
            } else {
                invalidDateFormat++;
                corruptDates.push({
                    line: index + 2,
                    rawDate: rawDate,
                    dateOnly: dateOnly
                });
            }
        });

        console.log('\n📊 ANÁLISIS DE FECHAS:');
        console.log(`📄 Total registros: ${totalRecords}`);
        console.log(`📅 Con fecha: ${withDate}`);
        console.log(`❌ Sin fecha: ${withoutDate}`);
        console.log(`✅ Formato válido: ${validDateFormat}`);
        console.log(`⚠️ Formato inválido: ${invalidDateFormat}`);

        // Mostrar fechas corruptas (primeras 10)
        if (corruptDates.length > 0) {
            console.log('\n⚠️ FECHAS CORRUPTAS (primeras 10):');
            corruptDates.slice(0, 10).forEach(item => {
                console.log(`   Línea ${item.line}: "${item.rawDate}" -> "${item.dateOnly}"`);
            });
        }

        // Mostrar distribución de fechas válidas
        const sortedDates = Object.keys(dateDistribution).sort();
        console.log('\n📅 DISTRIBUCIÓN DE FECHAS VÁLIDAS:');

        // Agrupar por mes para vista general
        const monthlyDistribution = {};
        sortedDates.forEach(date => {
            const month = date.substring(0, 7); // YYYY-MM
            if (!monthlyDistribution[month]) {
                monthlyDistribution[month] = 0;
            }
            monthlyDistribution[month] += dateDistribution[date];
        });

        console.log('\n📊 POR MES:');
        Object.keys(monthlyDistribution).sort().forEach(month => {
            console.log(`   ${month}: ${monthlyDistribution[month]} registros`);
        });

        // Mostrar fechas específicas con más registros
        console.log('\n📊 FECHAS CON MÁS REGISTROS (top 15):');
        const topDates = Object.entries(dateDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        topDates.forEach(([date, count]) => {
            console.log(`   ${date}: ${count} registros`);
        });

        // Detectar datos antes del 21 de septiembre
        console.log('\n🔍 ANÁLISIS ESPECÍFICO - DATOS ANTES DEL 21 SEP 2024:');
        const cutoffDate = '2024-09-21';
        let beforeCutoff = 0;
        let afterCutoff = 0;

        validDates.forEach(date => {
            if (date < cutoffDate) {
                beforeCutoff++;
            } else {
                afterCutoff++;
            }
        });

        console.log(`❌ Antes del 21 Sep 2024: ${beforeCutoff} registros`);
        console.log(`✅ Desde el 21 Sep 2024: ${afterCutoff} registros`);
        console.log(`📊 Porcentaje a filtrar: ${(beforeCutoff / (beforeCutoff + afterCutoff) * 100).toFixed(1)}%`);

        return {
            totalRecords,
            validDates: validDateFormat,
            beforeCutoff,
            afterCutoff,
            dateDistribution
        };

    } catch (error) {
        console.error('❌ Error analizando fechas:', error.message);
    }
}

// Analizar el archivo que el usuario tiene
const csvFile = process.argv[2] || './data.csv';
if (fs.existsSync(csvFile)) {
    console.log(`🔍 Analizando archivo: ${csvFile}`);
    analyzeDates(csvFile);
} else {
    console.log(`❌ Archivo no encontrado: ${csvFile}`);
    console.log('💡 Uso: node analyze-dates.js [archivo.csv]');
}