import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        // Read the CSV file
        const csvPath = path.join(process.cwd(), 'static', 'sample-data.csv');
        const csv = fs.readFileSync(csvPath, 'utf8');

        // Parse CSV similar to how the client does it
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

        // Apply the intelligent validation
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
                return false;
            } else {
                stats.valid++;
                return true;
            }
        });

        console.log('🧪 SERVER-SIDE CSV TEST:');
        console.log(`📄 Total lines: ${lines.length}`);
        console.log(`📊 Headers: ${headers.join(', ')}`);
        console.log(`📊 Parsed records: ${data.length}`);
        console.log(`📊 VALIDATION STATS:
            - Con texto: ${stats.withText}
            - Con usuario: ${stats.withUser}
            - Con fecha: ${stats.withDate}
            - Con source: ${stats.withSource}
            - Completamente vacíos: ${stats.totallyEmpty}
            - Registros válidos: ${stats.valid}
            - Porcentaje conservado: ${((stats.valid / data.length) * 100).toFixed(1)}%
        `);

        return new Response(JSON.stringify({
            success: true,
            csvLength: csv.length,
            totalLines: lines.length,
            headers,
            totalRecords: data.length,
            validRecords: stats.valid,
            stats,
            sampleData: validData.slice(0, 3)
        }), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('❌ Server-side CSV test failed:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}