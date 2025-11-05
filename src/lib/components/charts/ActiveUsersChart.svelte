<script>
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let data = [];
	export let chartType = 'doughnut';
	export let limit = 10;
	export let colorPalette = 'chilean';
	export let metric = 'posts'; // 'posts' o 'engagement'

	let canvas;
	let chartInstance;
	let mounted = false;

	// Estado del modal
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Web Worker state
	let worker = null;
	let isProcessing = false;
	let processingProgress = 0;
	let userData = [];
	let hiddenUsers = new Set(); // Usuarios ocultos

	// Registrar Chart.js solo una vez
	if (typeof window !== 'undefined') {
		Chart.register(...registerables);
	}

	$: if (mounted && data.length > 0) {
		processDataWithWorker();
	}

	$: if (mounted && canvas && userData.length > 0 && (chartType || limit || colorPalette || metric)) {
		createChart();
	}

	function processDataWithWorker() {
		if (!worker || !data || data.length === 0) return;

		console.log(`🔧 Iniciando procesamiento de ${data.length} posts con Worker...`);
		isProcessing = true;
		processingProgress = 0;

		worker.postMessage({
			posts: data,
			chunkSize: 10000
		});
	}

	function createChart() {
		if (!canvas || userData.length === 0) return;

		// Destruir gráfico existente
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = canvas.getContext('2d');

		// Ordenar según la métrica seleccionada, filtrar usuarios ocultos y limitar
		const sortedUsers = userData
			.filter(u => !hiddenUsers.has(u.userName))
			.sort((a, b) => {
				if (metric === 'engagement') {
					return b.totalEngagement - a.totalEngagement;
				}
				return b.count - a.count;
			})
			.slice(0, limit);

		console.log('📊 Renderizando', sortedUsers.length, 'usuarios de', userData.length, 'únicos (', hiddenUsers.size, 'ocultos) - Métrica:', metric);

		// Preparar datos para el gráfico según la métrica
		const labels = sortedUsers.map(u => u.userName);
		const chartData = sortedUsers.map(u => metric === 'engagement' ? u.totalEngagement : u.count);

		// Definir todas las paletas de colores disponibles
		const colorPalettes = {
			// NUEVA PALETA EXTENDIDA: 40 colores altamente diferenciados
			// Usa distribución HSL para máxima diferenciación visual
			extended: [
				// Rojos (0-15°)
				{ bg: 'rgba(220, 38, 38, 0.85)', border: '#dc2626' },
				{ bg: 'rgba(185, 28, 28, 0.85)', border: '#b91c1c' },
				// Naranjas (15-45°)
				{ bg: 'rgba(249, 115, 22, 0.85)', border: '#ea580c' },
				{ bg: 'rgba(234, 88, 12, 0.85)', border: '#c2410c' },
				{ bg: 'rgba(251, 146, 60, 0.85)', border: '#fb923c' },
				// Amarillos (45-75°)
				{ bg: 'rgba(251, 191, 36, 0.85)', border: '#f59e0b' },
				{ bg: 'rgba(245, 158, 11, 0.85)', border: '#d97706' },
				{ bg: 'rgba(250, 204, 21, 0.85)', border: '#facc15' },
				// Verde-Amarillo (75-105°)
				{ bg: 'rgba(190, 242, 100, 0.85)', border: '#bef264' },
				{ bg: 'rgba(163, 230, 53, 0.85)', border: '#a3e635' },
				{ bg: 'rgba(132, 204, 22, 0.85)', border: '#84cc16' },
				// Verdes (105-165°)
				{ bg: 'rgba(74, 222, 128, 0.85)', border: '#4ade80' },
				{ bg: 'rgba(34, 197, 94, 0.85)', border: '#22c55e' },
				{ bg: 'rgba(22, 163, 74, 0.85)', border: '#16a34a' },
				{ bg: 'rgba(21, 128, 61, 0.85)', border: '#15803d' },
				// Verde-Azul/Teal (165-195°)
				{ bg: 'rgba(20, 184, 166, 0.85)', border: '#14b8a6' },
				{ bg: 'rgba(13, 148, 136, 0.85)', border: '#0d9488' },
				{ bg: 'rgba(15, 118, 110, 0.85)', border: '#0f766e' },
				// Cyan (195-225°)
				{ bg: 'rgba(6, 182, 212, 0.85)', border: '#06b6d4' },
				{ bg: 'rgba(8, 145, 178, 0.85)', border: '#0891b2' },
				{ bg: 'rgba(14, 116, 144, 0.85)', border: '#0e7490' },
				// Azules (225-255°)
				{ bg: 'rgba(59, 130, 246, 0.85)', border: '#3b82f6' },
				{ bg: 'rgba(37, 99, 235, 0.85)', border: '#2563eb' },
				{ bg: 'rgba(29, 78, 216, 0.85)', border: '#1d4ed8' },
				{ bg: 'rgba(30, 58, 138, 0.85)', border: '#1e3a8a' },
				// Indigo (255-270°)
				{ bg: 'rgba(99, 102, 241, 0.85)', border: '#6366f1' },
				{ bg: 'rgba(79, 70, 229, 0.85)', border: '#4f46e5' },
				{ bg: 'rgba(67, 56, 202, 0.85)', border: '#4338ca' },
				// Púrpura (270-300°)
				{ bg: 'rgba(168, 85, 247, 0.85)', border: '#a855f7' },
				{ bg: 'rgba(147, 51, 234, 0.85)', border: '#9333ea' },
				{ bg: 'rgba(126, 34, 206, 0.85)', border: '#7e22ce' },
				{ bg: 'rgba(107, 33, 168, 0.85)', border: '#6b21a8' },
				// Fucsia/Magenta (300-330°)
				{ bg: 'rgba(217, 70, 239, 0.85)', border: '#d946ef' },
				{ bg: 'rgba(192, 38, 211, 0.85)', border: '#c026d3' },
				{ bg: 'rgba(162, 28, 175, 0.85)', border: '#a21caf' },
				// Rosa (330-360°)
				{ bg: 'rgba(236, 72, 153, 0.85)', border: '#ec4899' },
				{ bg: 'rgba(219, 39, 119, 0.85)', border: '#db2777' },
				{ bg: 'rgba(190, 24, 93, 0.85)', border: '#be185d' },
				// Marrones (tierra)
				{ bg: 'rgba(180, 83, 9, 0.85)', border: '#b45309' },
				{ bg: 'rgba(146, 64, 14, 0.85)', border: '#92400e' }
			],
			chilean: [
				// Azules Chile (tonos de la bandera)
				{ bg: 'rgba(0, 56, 168, 0.85)', border: '#0038a8' },        // Azul bandera oficial
				{ bg: 'rgba(30, 64, 175, 0.85)', border: '#1e40af' },       // Azul oscuro
				{ bg: 'rgba(37, 99, 235, 0.85)', border: '#1e3a8a' },       // Azul medio-oscuro
				{ bg: 'rgba(59, 130, 246, 0.85)', border: '#2563eb' },      // Azul medio
				{ bg: 'rgba(96, 165, 250, 0.85)', border: '#3b82f6' },      // Azul medio-claro
				{ bg: 'rgba(147, 197, 253, 0.85)', border: '#60a5fa' },     // Azul claro
				{ bg: 'rgba(191, 219, 254, 0.85)', border: '#93c5fd' },     // Azul muy claro
				// Rojos Chile (tonos de la bandera)
				{ bg: 'rgba(214, 40, 40, 0.85)', border: '#d62828' },       // Rojo bandera oficial
				{ bg: 'rgba(153, 27, 27, 0.85)', border: '#991b1b' },       // Rojo oscuro
				{ bg: 'rgba(185, 28, 28, 0.85)', border: '#b91c1c' },       // Rojo medio-oscuro
				{ bg: 'rgba(220, 38, 38, 0.85)', border: '#dc2626' },       // Rojo medio
				{ bg: 'rgba(239, 68, 68, 0.85)', border: '#ef4444' },       // Rojo medio-claro
				{ bg: 'rgba(248, 113, 113, 0.85)', border: '#f87171' },     // Rojo claro
				{ bg: 'rgba(252, 165, 165, 0.85)', border: '#fca5a5' }      // Rojo muy claro
			],
			vibrant: [
				{ bg: 'rgba(239, 68, 68, 0.85)', border: '#dc2626' },     // Rojo
				{ bg: 'rgba(249, 115, 22, 0.85)', border: '#ea580c' },    // Naranja
				{ bg: 'rgba(251, 191, 36, 0.85)', border: '#f59e0b' },    // Amarillo
				{ bg: 'rgba(132, 204, 22, 0.85)', border: '#84cc16' },    // Lima
				{ bg: 'rgba(34, 197, 94, 0.85)', border: '#22c55e' },     // Verde
				{ bg: 'rgba(20, 184, 166, 0.85)', border: '#14b8a6' },    // Teal
				{ bg: 'rgba(6, 182, 212, 0.85)', border: '#06b6d4' },     // Cyan
				{ bg: 'rgba(59, 130, 246, 0.85)', border: '#3b82f6' },    // Azul
				{ bg: 'rgba(99, 102, 241, 0.85)', border: '#6366f1' },    // Indigo
				{ bg: 'rgba(168, 85, 247, 0.85)', border: '#a855f7' },    // Púrpura
				{ bg: 'rgba(217, 70, 239, 0.85)', border: '#d946ef' },    // Fucsia
				{ bg: 'rgba(236, 72, 153, 0.85)', border: '#ec4899' }     // Rosa
			],
			pastel: [
				{ bg: 'rgba(254, 202, 202, 0.9)', border: '#fca5a5' },    // Rosa pastel
				{ bg: 'rgba(253, 230, 138, 0.9)', border: '#fde047' },    // Amarillo pastel
				{ bg: 'rgba(187, 247, 208, 0.9)', border: '#86efac' },    // Verde pastel
				{ bg: 'rgba(165, 243, 252, 0.9)', border: '#67e8f9' },    // Cyan pastel
				{ bg: 'rgba(191, 219, 254, 0.9)', border: '#93c5fd' },    // Azul pastel
				{ bg: 'rgba(221, 214, 254, 0.9)', border: '#c4b5fd' },    // Púrpura pastel
				{ bg: 'rgba(251, 207, 232, 0.9)', border: '#f9a8d4' },    // Rosa claro pastel
				{ bg: 'rgba(254, 215, 170, 0.9)', border: '#fdba74' },    // Naranja pastel
				{ bg: 'rgba(209, 250, 229, 0.9)', border: '#86efac' },    // Mint pastel
				{ bg: 'rgba(207, 250, 254, 0.9)', border: '#a5f3fc' }     // Cielo pastel
			],
			ocean: [
				{ bg: 'rgba(12, 74, 110, 0.85)', border: '#0c4a6e' },     // Azul marino oscuro
				{ bg: 'rgba(7, 89, 133, 0.85)', border: '#075985' },      // Azul marino
				{ bg: 'rgba(3, 105, 161, 0.85)', border: '#0369a1' },     // Azul océano
				{ bg: 'rgba(2, 132, 199, 0.85)', border: '#0284c7' },     // Azul cielo
				{ bg: 'rgba(6, 182, 212, 0.85)', border: '#06b6d4' },     // Cyan
				{ bg: 'rgba(20, 184, 166, 0.85)', border: '#14b8a6' },    // Teal
				{ bg: 'rgba(13, 148, 136, 0.85)', border: '#0d9488' },    // Teal oscuro
				{ bg: 'rgba(15, 118, 110, 0.85)', border: '#0f766e' },    // Verde azulado
				{ bg: 'rgba(19, 78, 74, 0.85)', border: '#134e4a' },      // Verde oscuro azulado
				{ bg: 'rgba(22, 101, 52, 0.85)', border: '#166534' }      // Verde profundo
			],
			sunset: [
				{ bg: 'rgba(127, 29, 29, 0.85)', border: '#7f1d1d' },     // Rojo oscuro
				{ bg: 'rgba(153, 27, 27, 0.85)', border: '#991b1b' },     // Rojo vino
				{ bg: 'rgba(185, 28, 28, 0.85)', border: '#b91c1c' },     // Rojo
				{ bg: 'rgba(220, 38, 38, 0.85)', border: '#dc2626' },     // Rojo brillante
				{ bg: 'rgba(239, 68, 68, 0.85)', border: '#ef4444' },     // Rojo claro
				{ bg: 'rgba(248, 113, 113, 0.85)', border: '#f87171' },   // Salmón
				{ bg: 'rgba(251, 146, 60, 0.85)', border: '#fb923c' },    // Naranja
				{ bg: 'rgba(253, 186, 116, 0.85)', border: '#fdba74' },   // Naranja claro
				{ bg: 'rgba(254, 215, 170, 0.85)', border: '#fed7aa' },   // Melocotón
				{ bg: 'rgba(254, 240, 138, 0.85)', border: '#fef08a' }    // Amarillo suave
			],
			forest: [
				{ bg: 'rgba(20, 83, 45, 0.85)', border: '#14532d' },      // Verde bosque oscuro
				{ bg: 'rgba(22, 101, 52, 0.85)', border: '#166534' },     // Verde oscuro
				{ bg: 'rgba(21, 128, 61, 0.85)', border: '#15803d' },     // Verde
				{ bg: 'rgba(22, 163, 74, 0.85)', border: '#16a34a' },     // Verde brillante
				{ bg: 'rgba(34, 197, 94, 0.85)', border: '#22c55e' },     // Verde claro
				{ bg: 'rgba(74, 222, 128, 0.85)', border: '#4ade80' },    // Verde lima
				{ bg: 'rgba(132, 204, 22, 0.85)', border: '#84cc16' },    // Lima
				{ bg: 'rgba(163, 230, 53, 0.85)', border: '#a3e635' },    // Lima brillante
				{ bg: 'rgba(190, 242, 100, 0.85)', border: '#bef264' },   // Lima claro
				{ bg: 'rgba(217, 249, 157, 0.85)', border: '#d9f99d' }    // Verde amarillento
			],
			monochrome: [
				{ bg: 'rgba(23, 23, 23, 0.85)', border: '#171717' },      // Negro
				{ bg: 'rgba(38, 38, 38, 0.85)', border: '#262626' },      // Gris muy oscuro
				{ bg: 'rgba(64, 64, 64, 0.85)', border: '#404040' },      // Gris oscuro
				{ bg: 'rgba(82, 82, 82, 0.85)', border: '#525252' },      // Gris medio-oscuro
				{ bg: 'rgba(115, 115, 115, 0.85)', border: '#737373' },   // Gris medio
				{ bg: 'rgba(163, 163, 163, 0.85)', border: '#a3a3a3' },   // Gris medio-claro
				{ bg: 'rgba(212, 212, 212, 0.85)', border: '#d4d4d4' },   // Gris claro
				{ bg: 'rgba(229, 229, 229, 0.85)', border: '#e5e5e5' },   // Gris muy claro
				{ bg: 'rgba(245, 245, 245, 0.85)', border: '#f5f5f5' },   // Blanco grisáceo
				{ bg: 'rgba(250, 250, 250, 0.85)', border: '#fafafa' }    // Blanco
			],
			neon: [
				{ bg: 'rgba(255, 0, 102, 0.85)', border: '#ff0066' },     // Rosa neón
				{ bg: 'rgba(255, 51, 153, 0.85)', border: '#ff3399' },    // Rosa fucsia neón
				{ bg: 'rgba(204, 51, 255, 0.85)', border: '#cc33ff' },    // Púrpura neón
				{ bg: 'rgba(102, 51, 255, 0.85)', border: '#6633ff' },    // Azul púrpura neón
				{ bg: 'rgba(0, 102, 255, 0.85)', border: '#0066ff' },     // Azul neón
				{ bg: 'rgba(0, 204, 255, 0.85)', border: '#00ccff' },     // Cyan neón
				{ bg: 'rgba(0, 255, 204, 0.85)', border: '#00ffcc' },     // Turquesa neón
				{ bg: 'rgba(51, 255, 153, 0.85)', border: '#33ff99' },    // Verde menta neón
				{ bg: 'rgba(153, 255, 51, 0.85)', border: '#99ff33' },    // Lima neón
				{ bg: 'rgba(255, 255, 0, 0.85)', border: '#ffff00' }      // Amarillo neón
			]
		};

		// Seleccionar la paleta actual
		const selectedPalette = colorPalettes[colorPalette] || colorPalettes.chilean;

		// Generar colores para cada usuario
		const backgroundColors = sortedUsers.map((_, index) => {
			const colorIndex = index % selectedPalette.length;
			return selectedPalette[colorIndex].bg;
		});

		const borderColors = sortedUsers.map((_, index) => {
			const colorIndex = index % selectedPalette.length;
			return selectedPalette[colorIndex].border;
		});

		const isDoughnutOrPie = chartType === 'doughnut' || chartType === 'pie';

		chartInstance = new Chart(ctx, {
			type: chartType === 'horizontalBar' ? 'bar' : chartType,
			data: {
				labels: labels,
				datasets: [{
					label: metric === 'engagement' ? 'Engagement' : 'Posts',
					data: chartData,
					backgroundColor: backgroundColors,
					borderColor: borderColors,
					borderWidth: 1
				}]
			},
			options: {
				indexAxis: chartType === 'horizontalBar' ? 'y' : 'x',
				responsive: true,
				maintainAspectRatio: false,
				onClick: (event, elements) => {
					if (elements.length > 0) {
						const index = elements[0].index;
						const clickedUser = sortedUsers[index];

						// Usar event.native para detectar el tipo de click
						if (event.native && event.native.detail === 2) {
							// Doble click: ocultar usuario
							hiddenUsers.add(clickedUser.userName);
							hiddenUsers = hiddenUsers; // Trigger reactivity
							console.log('🙈 Usuario oculto:', clickedUser.userName);
							createChart(); // Re-renderizar
						} else {
							// Click simple: mostrar modal
							selectedTitle = `Posts de ${clickedUser.userName}`;
							selectedPosts = clickedUser.posts;
							showModal = true;
							console.log('📊 Click en usuario:', clickedUser.userName, '-', clickedUser.count, 'posts');
						}
					}
				},
				plugins: {
					title: {
						display: true,
						text: `Top ${limit} Usuarios ${metric === 'engagement' ? 'con Mayor Engagement' : 'Más Activos'}${hiddenUsers.size > 0 ? ` (${hiddenUsers.size} ocultos)` : ''}`
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const index = context.dataIndex;
								const user = sortedUsers[index];
								return [
									`Posts: ${user.count}`,
									`Engagement total: ${user.totalEngagement.toLocaleString()}`,
									'',
									'💡 Click: Ver posts',
									'💡 Doble-click: Ocultar usuario'
								];
							}
						}
					},
					legend: {
						display: isDoughnutOrPie,
						position: 'right'
					}
				},
				scales: chartType === 'doughnut' || chartType === 'pie' ? {} : {
					x: {
						beginAtZero: true,
						title: {
							display: chartType !== 'horizontalBar',
							text: 'Usuario'
						}
					},
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: metric === 'engagement' ? 'Engagement Total' : 'Cantidad de Posts'
						}
					}
				}
			}
		});

		console.log('📊 Active Users chart created');
	}

	onMount(() => {
		mounted = true;
		console.log('📊 ActiveUsersChart montado, datos:', data.length);

		// Inicializar Web Worker
		if (typeof window !== 'undefined') {
			worker = new Worker(new URL('$lib/workers/activeusers.worker.js', import.meta.url), { type: 'module' });

			worker.onmessage = function(e) {
				const { type, data: workerData, progress, message, duration } = e.data;

				if (type === 'progress') {
					processingProgress = progress;
					console.log(`⏳ ${message} - ${progress}%`);
				} else if (type === 'complete') {
					isProcessing = false;
					processingProgress = 100;
					userData = workerData.userData;
					console.log(`✅ Worker completado en ${duration}ms - ${workerData.stats.totalUsers} usuarios únicos`);

					// Trigger chart creation
					if (canvas) {
						createChart();
					}
				}
			};

			worker.onerror = function(error) {
				console.error('❌ Error en Worker:', error);
				isProcessing = false;
			};
		}

		// Procesar datos si ya están disponibles
		if (data.length > 0) {
			processDataWithWorker();
		}
	});

	onDestroy(() => {
		if (worker) {
			worker.terminate();
		}
		if (chartInstance) {
			chartInstance.destroy();
		}
	});
</script>

<div class="active-users-container">
	{#if data.length === 0}
		<div class="no-data-message">
			<div class="no-data-icon">👥</div>
			<h3>No hay datos disponibles</h3>
			<p>No se encontraron usuarios con los filtros seleccionados</p>
		</div>
	{:else if isProcessing}
		<div class="processing-message">
			<div class="spinner"></div>
			<h3>Procesando usuarios activos...</h3>
			<p>{processingProgress}% completado</p>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {processingProgress}%"></div>
			</div>
		</div>
	{:else}
		<div class="chart-wrapper">
			<canvas bind:this={canvas} class="chart-canvas"></canvas>
			{#if hiddenUsers.size > 0}
				<button
					class="restore-users-btn"
					on:click={() => {
						hiddenUsers.clear();
						hiddenUsers = hiddenUsers;
						createChart();
					}}
					title="Restaurar todos los usuarios ocultos"
				>
					🔄 Restaurar {hiddenUsers.size} usuario{hiddenUsers.size > 1 ? 's' : ''}
				</button>
			{/if}
		</div>
	{/if}
</div>

<PostDetailsModal
	bind:isOpen={showModal}
	posts={selectedPosts}
	date={selectedTitle}
	on:close={() => showModal = false}
/>

<style>
	.active-users-container {
		position: relative;
		cursor: pointer;
	}

	.chart-wrapper {
		position: relative;
		width: 100%;
	}

	.chart-canvas {
		width: 100% !important;
		height: 400px !important;
		max-height: 400px;
		cursor: pointer;
	}

	.restore-users-btn {
		position: absolute;
		bottom: 10px;
		right: 10px;
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
		z-index: 10;
	}

	.restore-users-btn:hover {
		background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(37, 99, 235, 0.4);
	}

	.restore-users-btn:active {
		transform: translateY(0);
	}

	.no-data-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: #666;
		text-align: center;
	}

	.no-data-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
		opacity: 0.3;
	}

	.no-data-message h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.no-data-message p {
		margin: 0;
		font-size: 1rem;
		color: #999;
	}

	.processing-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: #666;
		text-align: center;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid rgba(52, 152, 219, 0.2);
		border-top-color: #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.processing-message h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
		color: #333;
	}

	.processing-message p {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #999;
	}

	.progress-bar {
		width: 300px;
		height: 8px;
		background-color: rgba(52, 152, 219, 0.2);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background-color: #3498db;
		transition: width 0.3s ease;
	}
</style>