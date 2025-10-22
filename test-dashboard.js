// Test automatizado del dashboard
console.log("🧪 TESTING DASHBOARD SVELTE\n");

const checks = {
	passed: 0,
	failed: 0,
	warnings: 0
};

// Test 1: Verificar componentes de gráficos
console.log("📊 Test 1: Verificando componentes de gráficos...");
const fs = require('fs');
const chartComponents = [
	'TimelineChart.svelte',
	'TopPostsChart.svelte',
	'ActiveUsersChart.svelte',
	'EngagementScatterChart.svelte',
	'HashtagsChart.svelte',
	'SentimentChart.svelte',
	'PerformanceChart.svelte',
	'MentionsChart.svelte',
	'WordCloudChart.svelte',
	'NetworkComparisonChart.svelte',
	'HeatmapCalendarChart.svelte'
];

chartComponents.forEach(component => {
	const path = `src/lib/components/charts/${component}`;
	if (fs.existsSync(path)) {
		console.log(`  ✅ ${component}`);
		checks.passed++;
	} else {
		console.log(`  ❌ ${component} - NO ENCONTRADO`);
		checks.failed++;
	}
});

// Test 2: Verificar Web Workers
console.log("\n⚙️ Test 2: Verificando Web Workers...");
const workers = [
	'timeline.worker.js',
	'topposts.worker.js',
	'activeusers.worker.js',
	'scatter.worker.js',
	'hashtags.worker.js',
	'sentiment.worker.js',
	'performance.worker.js',
	'mentions.worker.js',
	'wordcloud.worker.js',
	'networkcomparison.worker.js',
	'heatmap.worker.js'
];

workers.forEach(worker => {
	const path = `src/lib/workers/${worker}`;
	if (fs.existsSync(path)) {
		console.log(`  ✅ ${worker}`);
		checks.passed++;
	} else {
		console.log(`  ❌ ${worker} - NO ENCONTRADO`);
		checks.failed++;
	}
});

// Test 3: Verificar stores
console.log("\n📦 Test 3: Verificando stores...");
const stores = ['dashboard.js'];
stores.forEach(store => {
	const path = `src/lib/stores/${store}`;
	if (fs.existsSync(path)) {
		console.log(`  ✅ ${store}`);
		checks.passed++;
	} else {
		console.log(`  ❌ ${store} - NO ENCONTRADO`);
		checks.failed++;
	}
});

// Test 4: Verificar componentes base
console.log("\n🔧 Test 4: Verificando componentes base...");
const baseComponents = [
	'UnifiedHeader.svelte',
	'ChartWidget.svelte',
	'ChartControls.svelte',
	'PostDetailsModal.svelte',
	'NetworkComparisonWidget.svelte'
];

baseComponents.forEach(component => {
	const path = `src/lib/components/${component}`;
	if (fs.existsSync(path)) {
		console.log(`  ✅ ${component}`);
		checks.passed++;
	} else {
		console.log(`  ❌ ${component} - NO ENCONTRADO`);
		checks.failed++;
	}
});

// Test 5: Verificar datos de prueba
console.log("\n📄 Test 5: Verificando datos de prueba...");
const dataFiles = [
	'../kast-prueba.csv',
	'../kast.csv'
];

dataFiles.forEach(file => {
	if (fs.existsSync(file)) {
		const stats = fs.statSync(file);
		console.log(`  ✅ ${file.split('/').pop()} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
		checks.passed++;
	} else {
		console.log(`  ⚠️ ${file.split('/').pop()} - No encontrado`);
		checks.warnings++;
	}
});

// Resumen
console.log("\n" + "=".repeat(50));
console.log("📊 RESUMEN DEL TESTING:");
console.log("=".repeat(50));
console.log(`✅ Tests pasados: ${checks.passed}`);
console.log(`❌ Tests fallidos: ${checks.failed}`);
console.log(`⚠️ Warnings: ${checks.warnings}`);
console.log("\n" + (checks.failed === 0 ? "✅ TODOS LOS TESTS PASARON" : "❌ HAY ERRORES QUE CORREGIR"));
