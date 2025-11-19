<script>
	import { onMount } from 'svelte';
	import PostDetailsModal from '$lib/components/PostDetailsModal.svelte';

	export let posts = [];
	export let limit = 50; // Mostrar 50 por defecto

	let displayedPosts = [];
	let currentPage = 1;
	let itemsPerPage = 50;
	let totalPages = 1;
	let searchFilter = '';

	// Filtros de tipo de medio
	let mediaTypeFilters = {
		Nacional: true,
		Regional: true
	};
	let mediaClassification = {}; // Mapa de dominio -> { tipo, region, ciudad }

	// Lista de medios excluidos (filtrados de la visualización)
	const excludedMediaDomains = [
		'elmartutino.cl'
	];

	// Modal state
	let showModal = false;
	let selectedPosts = [];
	let selectedTitle = '';

	// Cargar clasificación de medios
	onMount(async () => {
		try {
			const response = await fetch('/mediosporregion.csv');
			const text = await response.text();
			const lines = text.split('\n');

			// Saltar el header
			for (let i = 1; i < lines.length; i++) {
				const line = lines[i].trim();
				if (!line) continue;

				const parts = line.split(',');
				if (parts.length >= 5) {
					const domain = parts[0].trim();
					const region = parts[2]?.trim() || '';
					const ciudad = parts[3]?.trim() || '';
					const tipo = parts[4].trim();
					if (domain && tipo) {
						mediaClassification[domain] = { tipo, region, ciudad };
					}
				}
			}
			console.log('✅ Clasificación de medios cargada:', Object.keys(mediaClassification).length, 'medios');
		} catch (error) {
			console.error('❌ Error cargando clasificación de medios:', error);
		}
	});

	// Mapeo extenso de dominios a nombres de medios chilenos
	const mediaNames = {
		// Medios nacionales
		'latercera.com': 'La Tercera',
		'emol.com': 'Emol',
		'biobiochile.cl': 'BioBio',
		'lacuarta.com': 'La Cuarta',
		'elmostrador.cl': 'El Mostrador',
		'cnnchile.com': 'CNN',
		'pnt.cl': 'Puranoticia',
		'uchile.cl': 'Radio UCH',
		'bbc.com': 'BBC',
		't13.cl': 'T13',
		'meganoticias.cl': 'Meganoticias',
		'cooperativa.cl': 'Cooperativa',
		'24horas.cl': '24 Horas',
		'adnradio.cl': 'ADN Radio',
		'df.cl': 'Diario Financiero',
		'pulso.cl': 'Pulso',
		'lun.com': 'LUN',
		'pauta.cl': 'Pauta',
		'ciperchile.cl': 'CIPER Chile',
		'eldesconcierto.cl': 'El Desconcierto',
		'ex-ante.cl': 'Ex-Ante',
		'eldinamo.cl': 'El Dínamo',
		'chilevision.cl': 'Chilevisión',
		'13.cl': 'Canal 13',
		'elmercurio.com': 'El Mercurio',
		'lanacion.cl': 'La Nación',
		'soychile.cl': 'Soy Chile',
		'publimetro.cl': 'Publimetro',
		'lasegunda.com': 'La Segunda',
		'chvnoticias.cl': 'CHV Noticias',
		'redgol.cl': 'RedGol',
		'theclinic.cl': 'The Clinic',
		'ellibero.cl': 'El Líbero',
		'radioagricultura.cl': 'Radio Agricultura',
		'nuevopoder.cl': 'Nuevo Poder',
		'gamba.cl': 'Gamba',
		'interferencia.cl': 'Interferencia',
		'laizquierdadiario.cl': 'La Izquierda Diario',
		'encancha.cl': 'En Cancha',

		// Medios regionales - Norte
		'aricaldia.cl': 'Arica al Día',
		'elmorrocotudo.cl': 'El Morrocotudo',
		'elsoldeiquique.cl': 'El Sol de Iquique',
		'elreporterodeiquique.com': 'El Reportero de Iquique',
		'tarapacaonline.cl': 'Tarapacá Online',
		'ceinoticias.cl': 'CEI Noticias',
		'timeline.cl': 'Timeline',
		'antofagastaaldia.cl': 'Antofagasta al Día',
		'diarioantofagasta.cl': 'Diario Antofagasta',
		'calamaenlinea.cl': 'Calama en Línea',
		'elnortero.cl': 'El Nortero',
		'atacamanoticias.cl': 'Atacama Noticias',
		'chanarcillo.cl': 'El Chanarcillo',
		'tierramarillano.cl': 'El Tierra Amarillano',
		'elzorronortino.cl': 'El Zorro Nortino',

		// Medios regionales - Centro
		'reportediario.cl': 'Reporte Diario',
		'cronicadigital.cl': 'Crónica Digital',
		'eldiarioeldia.cl': 'El Diario El Día',
		'diarioeldia.cl': 'Diario El Día',
		'elserenense.cl': 'El Serenense',
		'fmdos.cl': 'FM Dos',
		'laserenaonline.cl': 'La Serena Online',
		'miradiols.cl': 'Miradio LS',
		'elovallino.cl': 'El Ovallino',
		'elobservatodo.cl': 'El Observatodo',
		'ovallehoy.cl': 'Ovalle Hoy',
		'losandesonline.cl': 'Los Andes Online',
		'epicentrochile.com': 'Epicentro Chile',
		'observador.cl': 'El Observador',
		'eltipografo.cl': 'El Tipógrafo',
		'elmartutino.cl': 'El Martutino',
		'elrepuertero.cl': 'El Repuertero',
		'laprensaaustral.cl': 'La Prensa Austral',

		// Medios regionales - Sur
		'elrancaguino.cl': 'El Rancagüino',
		'elrancahuaso.cl': 'El Rancahuaso',
		'diariolaprensa.cl': 'Diario La Prensa',
		'diarioelcentro.cl': 'Diario El Centro',
		'diariotalca.cl': 'Diario Talca',
		'chicureohoy.cl': 'Chillán Hoy',
		'ladiscusion.cl': 'La Discusión',
		'nubleonline.cl': 'Ñuble Online',
		'sancarlosonline.cl': 'San Carlos Online',
		'elvacanudo.cl': 'El Vacanudo',
		'contactoconce.cl': 'Contacto Conce',
		'latribuna.cl': 'La Tribuna',
		'publimicro.cl': 'Publimicro',
		'elcontraste.cl': 'El Contraste',
		'lavozdepucon.cl': 'La Voz de Pucón',
		'araucaniadiario.cl': 'Araucanía Diario',
		'temucotelevision.cl': 'Temuco Televisión',
		'diariolagoranco.cl': 'Diario Lago Ranco',
		'diariodevaldivia.cl': 'Diario de Valdivia',
		'rioenlinea.cl': 'Río en Línea',
		'vilasradio.cl': 'Vilas Radio',
		'diariochiloe.cl': 'Diario Chiloé',
		'elinsular.cl': 'El Insular',
		'diariodeosorno.cl': 'Diario de Osorno',
		'paislobo.cl': 'Pais Lobo',
		'elcalbucano.cl': 'El Calbucano',
		'elhuemul.cl': 'El Huemul',
		'eha.cl': 'El Heraldo Austral',
		'diarioregionalaysen.cl': 'Diario Regional Aysén',
		'elpinguino.com': 'El Pingüino',
		'elmagallanews.cl': 'El Magallanews',

		// Radios y otros
		'radiocontacto.cl': 'Radio Contacto',
		'radiosago.cl': 'Radio Sago',
		'radioudec.cl': 'Radio UdeC',
		'radioprensa.cl': 'Radio Prensa',
		'uatv.cl': 'UATV'
	};

	// Función para convertir dominio a nombre legible del medio
	function getDomainDisplayName(domain) {
		if (!domain) return 'Desconocido';

		const lowerDomain = domain.toLowerCase();

		// Buscar en el mapeo manual
		if (mediaNames[lowerDomain]) {
			return mediaNames[lowerDomain];
		}

		// Si no está en el mapeo, intentar construir nombre legible
		let name = lowerDomain.split('.')[0];

		// Casos especiales de números
		if (name === 't13' || name === 'tele13') return 'T13';
		if (name === '24horas') return '24 Horas';
		if (name === '13') return 'Canal 13';

		// Si el nombre es muy corto (iniciales), agregar contexto de ciudad
		if (name.length <= 3 && mediaClassification[lowerDomain]) {
			const info = mediaClassification[lowerDomain];
			if (info.ciudad) {
				return `${name.toUpperCase()} ${info.ciudad}`;
			}
		}

		// Detectar y separar palabras comunes en español
		const palabrasComunes = [
			'el', 'la', 'los', 'las', 'de', 'del', 'diario', 'radio', 'noticias',
			'online', 'digital', 'aldia', 'hoy', 'television', 'prensa', 'austral',
			'norte', 'sur', 'chile', 'region', 'observa', 'todo', 'valle', 'puerto',
			'voz', 'reportero', 'insular', 'tribuna', 'chicureo', 'contacto', 'tiempo'
		];

		// Intentar detectar palabras concatenadas
		let resultado = name;
		for (let palabra of palabrasComunes) {
			// Detectar palabras al inicio
			if (name.startsWith(palabra) && name.length > palabra.length) {
				const resto = name.substring(palabra.length);
				// Capitalizar ambas partes
				resultado = capitalizeWord(palabra) + ' ' + capitalizeFirstLetter(resto);
				break;
			}
			// Detectar palabras al final
			if (name.endsWith(palabra) && name.length > palabra.length) {
				const inicio = name.substring(0, name.length - palabra.length);
				resultado = capitalizeFirstLetter(inicio) + ' ' + capitalizeWord(palabra);
				break;
			}
		}

		// Si no detectamos palabras, capitalizar con guiones/guiones bajos
		if (resultado === name) {
			resultado = name.split(/[-_]/)
				.map(word => capitalizeFirstLetter(word))
				.join(' ');
		}

		return resultado;
	}

	// Función auxiliar para capitalizar palabra
	function capitalizeWord(word) {
		const articulos = ['el', 'la', 'los', 'las', 'de', 'del', 'al'];
		if (articulos.includes(word.toLowerCase())) {
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		}
		return capitalizeFirstLetter(word);
	}

	// Función auxiliar para capitalizar primera letra
	function capitalizeFirstLetter(str) {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}

	// Función para extraer dominio del link
	function extractDomain(link) {
		if (!link) return 'Desconocido';
		try {
			const url = new URL(link);
			let domain = url.hostname.replace(/^www\./, '');

			// Casos especiales: Google News y Yahoo News redirects
			if (domain === 'google.com' || domain === 'news.google.com' ||
			    domain === 'yahoo.com' || domain === 'news.yahoo.com') {
				// Método 1: Parámetro 'url' en query string
				const urlParam = url.searchParams.get('url');
				if (urlParam) {
					try {
						const realUrl = new URL(urlParam);
						domain = realUrl.hostname.replace(/^www\./, '');
					} catch {}
				}

				// Método 2: Artículos codificados de Google News (formato /articles/CBMi...)
				if (domain === 'google.com' || domain === 'news.google.com') {
					const pathMatch = url.pathname.match(/\/articles\/CBMi([A-Za-z0-9_-]+)/);
					if (pathMatch) {
						try {
							// Decodificar Base64 URL-safe
							const base64 = pathMatch[1].replace(/-/g, '+').replace(/_/g, '/');
							const decoded = atob(base64);

							// Buscar URL en el texto decodificado
							const urlMatch = decoded.match(/https?:\/\/([^\/\s"'<>]+)/);
							if (urlMatch) {
								domain = urlMatch[1].replace(/^www\./, '');
							}
						} catch (e) {
							// Si falla la decodificación, mantener el dominio original
						}
					}
				}
			}

			// Limpiar subdominios móviles y regionales comunes
			domain = domain.replace(/^(mobile|m|amp|www2|www3|www4)\./, '');

			// Usar solo el nombre principal del dominio (ej: latercera.com en vez de news.latercera.com)
			const parts = domain.split('.');
			if (parts.length > 2) {
				// Mantener solo los últimos 2 segmentos para dominios como 'news.latercera.com'
				domain = parts.slice(-2).join('.');
			}

			return domain;

		} catch (e) {
			// Si el link no es válido, intentar extraer del string
			const match = link.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
			return match ? match[1].replace(/^www\./, '') : 'Desconocido';
		}
	}

	// Función para limpiar el titular (remover URLs extras, etc.)
	function cleanTitle(text) {
		if (!text) return 'Sin título';
		// Limitar longitud
		const maxLength = 150;
		let cleaned = text.trim();
		if (cleaned.length > maxLength) {
			cleaned = cleaned.substring(0, maxLength) + '...';
		}
		return cleaned;
	}

	// Preparar lista de publicaciones con medio y titular
	// OPTIMIZACIÓN: Procesar solo cuando posts cambie o searchFilter cambie
	let processedPosts = [];
	$: {
		// Filtrado básico primero (más rápido)
		const filtered = posts.filter(post => {
			// PRIMERO: Solo noticias (no redes sociales)
			const source = (post.source || '').toLowerCase();
			if (source !== 'news' && source !== 'noticias') return false;

			const link = (post.link || '').toLowerCase();
			// Excluir redes sociales
			if (link.includes('twitter.com') || link.includes('instagram.com') ||
			    link.includes('facebook.com') || link.includes('tiktok.com') ||
			    link.includes('x.com')) return false;

			return true;
		});

		// Mapear y ordenar
		processedPosts = filtered
			.map(post => {
				const domain = extractDomain(post.link);
				const mediaInfo = mediaClassification[domain];
				const mediaType = mediaInfo ? mediaInfo.tipo : 'Desconocido';
				return {
					...post,
					domain: domain,
					displayName: getDomainDisplayName(domain),
					cleanedTitle: cleanTitle(post.text),
					dateObj: new Date(post.created || 0),
					mediaType: mediaType
				};
			})
			// FILTRAR posts de agregadores de noticias que no se pudieron resolver
			.filter(post => {
				const domain = post.domain.toLowerCase();
				// Excluir Google, Yahoo y dominios desconocidos
				if (domain === 'google.com' || domain === 'yahoo.com' || domain === 'desconocido') {
					return false;
				}
				// Excluir medios de la lista de excluidos
				if (excludedMediaDomains.includes(domain)) {
					return false;
				}
				return true;
			})
			// FILTRAR por tipo de medio
			.filter(post => {
				// Si ambos filtros están activos o ambos inactivos, mostrar todo
				const bothActive = mediaTypeFilters.Nacional && mediaTypeFilters.Regional;
				const noneActive = !mediaTypeFilters.Nacional && !mediaTypeFilters.Regional;

				if (bothActive || noneActive) return true;

				// Si solo uno está activo, filtrar
				if (mediaTypeFilters.Nacional && post.mediaType === 'Nacional') return true;
				if (mediaTypeFilters.Regional && post.mediaType === 'Regional') return true;

				return false;
			})
			.sort((a, b) => b.dateObj - a.dateObj)
			.filter(post => {
				// Aplicar filtro de búsqueda después de ordenar
				if (searchFilter.trim()) {
					const filter = searchFilter.toLowerCase();
					return post.domain.toLowerCase().includes(filter) ||
					       post.displayName.toLowerCase().includes(filter) ||
					       post.cleanedTitle.toLowerCase().includes(filter);
				}
				return true;
			});
	}

	// Calcular paginación
	$: {
		totalPages = Math.ceil(processedPosts.length / itemsPerPage);
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		displayedPosts = processedPosts.slice(start, end);
	}

	function goToPage(page) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
	}

	function showPostDetails(post) {
		console.log('📰 Mostrando detalles del post:', post);
		selectedTitle = `${post.displayName || post.domain} - ${post.user_name || 'Usuario desconocido'}`;
		selectedPosts = [post];
		showModal = true;
		console.log('Modal state:', { showModal, selectedPosts: selectedPosts.length });
	}

	// Función para formatear fecha
	function formatDate(dateStr) {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString('es-CL', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateStr;
		}
	}
</script>

<div class="media-list-container">
	<div class="header">
		<h3>📰 Publicaciones por Medio</h3>
		<div class="controls">
			<input
				type="text"
				placeholder="Buscar por medio o contenido..."
				bind:value={searchFilter}
				class="search-input"
			/>
			<div class="filter-chips">
				<span class="filter-label">Tipo de medio:</span>
				<button
					class="filter-chip"
					class:active={mediaTypeFilters.Nacional}
					on:click={() => mediaTypeFilters.Nacional = !mediaTypeFilters.Nacional}
				>
					📡 Medios Nacionales
				</button>
				<button
					class="filter-chip"
					class:active={mediaTypeFilters.Regional}
					on:click={() => mediaTypeFilters.Regional = !mediaTypeFilters.Regional}
				>
					🏘️ Medios Regionales
				</button>
			</div>
			<div class="stats">
				<span class="total-count">{processedPosts.length} publicaciones</span>
			</div>
		</div>
	</div>

	<div class="media-list">
		{#if displayedPosts.length === 0}
			<div class="empty-state">
				<p>No hay publicaciones para mostrar</p>
			</div>
		{:else}
			{#each displayedPosts as post, index (`${post.link || ''}-${post.created || ''}-${index}`)}
				<div class="media-item-wrapper">
					<div class="media-item" title={formatDate(post.created)}>
						<div class="media-content">
							<span class="media-domain">{post.displayName}:</span>
							<span class="media-title">{post.cleanedTitle}</span>
						</div>
					</div>
					<div class="item-actions">
						<a
							href={post.link}
							target="_blank"
							rel="noopener noreferrer"
							class="link-btn"
							title="Abrir enlace"
						>
							🔗
						</a>
						<button
							class="details-btn"
							on:click|stopPropagation={() => showPostDetails(post)}
							title="Ver detalles del post"
						>
							ℹ️
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	{#if totalPages > 1}
		<div class="pagination">
			<button
				on:click={() => goToPage(currentPage - 1)}
				disabled={currentPage === 1}
				class="page-btn"
			>
				← Anterior
			</button>

			<span class="page-info">
				Página {currentPage} de {totalPages}
			</span>

			<button
				on:click={() => goToPage(currentPage + 1)}
				disabled={currentPage === totalPages}
				class="page-btn"
			>
				Siguiente →
			</button>
		</div>
	{/if}
</div>

{#if showModal}
	<PostDetailsModal
		posts={selectedPosts}
		date={selectedTitle}
		isOpen={showModal}
		on:close={() => showModal = false}
	/>
{/if}

<style>
	.media-list-container {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		padding: 20px;
		margin: 20px 0;
	}

	.header {
		margin-bottom: 20px;
		border-bottom: 2px solid #e0e0e0;
		padding-bottom: 15px;
	}

	.header h3 {
		margin: 0 0 10px 0;
		color: #2c3e50;
		font-size: 1.5em;
	}

	.controls {
		display: flex;
		gap: 15px;
		align-items: center;
		flex-wrap: wrap;
	}

	.search-input {
		flex: 1;
		min-width: 250px;
		padding: 10px 15px;
		border: 2px solid #e0e0e0;
		border-radius: 5px;
		font-size: 14px;
		transition: border-color 0.3s;
	}

	.search-input:focus {
		outline: none;
		border-color: #3498db;
	}

	.filter-chips {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	.filter-label {
		font-size: 14px;
		font-weight: 600;
		color: #2c3e50;
	}

	.filter-chip {
		padding: 8px 16px;
		border: 2px solid #bdc3c7;
		border-radius: 20px;
		background: white;
		color: #7f8c8d;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.3s;
		user-select: none;
	}

	.filter-chip:hover {
		border-color: #3498db;
		background: #ecf0f1;
	}

	.filter-chip.active {
		border-color: #3498db;
		background: #3498db;
		color: white;
		font-weight: 600;
	}

	.stats {
		display: flex;
		gap: 10px;
	}

	.total-count {
		background: #ecf0f1;
		padding: 8px 15px;
		border-radius: 5px;
		font-size: 14px;
		font-weight: 600;
		color: #2c3e50;
	}

	.media-list {
		max-height: 600px;
		overflow-y: auto;
		border: 1px solid #e0e0e0;
		border-radius: 5px;
	}

	.media-item-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		border-bottom: 1px solid #f0f0f0;
	}

	.media-item-wrapper:last-child {
		border-bottom: none;
	}

	.media-item {
		flex: 1;
		padding: 15px;
		display: block;
		user-select: text; /* Permitir selección de texto */
		cursor: text;
	}

	.item-actions {
		display: flex;
		gap: 8px;
		align-items: center;
		padding-right: 10px;
		flex-shrink: 0;
		user-select: none; /* No seleccionar los botones */
	}

	.link-btn {
		padding: 8px 12px;
		background: #27ae60;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 16px;
		transition: all 0.2s;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		user-select: none;
	}

	.link-btn:hover {
		background: #229954;
		transform: scale(1.1);
	}

	.details-btn {
		padding: 8px 12px;
		background: #ecf0f1;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 16px;
		transition: all 0.2s;
		flex-shrink: 0;
		user-select: none;
	}

	.details-btn:hover {
		background: #3498db;
		transform: scale(1.1);
	}

	.media-content {
		display: flex;
		gap: 8px;
		line-height: 1.5;
		font-family: 'Arial Narrow', Arial, sans-serif;
		font-size: 13px;
	}

	.media-domain {
		font-weight: 700;
		color: #000000;
		white-space: nowrap;
		flex-shrink: 0;
		font-size: 13px;
	}

	.media-title {
		color: #000000;
		flex: 1;
		font-size: 13px;
		font-style: italic;
	}

	.empty-state {
		padding: 40px;
		text-align: center;
		color: #7f8c8d;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 20px;
		margin-top: 20px;
		padding-top: 15px;
		border-top: 1px solid #e0e0e0;
	}

	.page-btn {
		padding: 8px 16px;
		background: #3498db;
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.3s;
	}

	.page-btn:hover:not(:disabled) {
		background: #2980b9;
	}

	.page-btn:disabled {
		background: #bdc3c7;
		cursor: not-allowed;
	}

	.page-info {
		font-weight: 600;
		color: #2c3e50;
	}

	/* Scrollbar styling */
	.media-list::-webkit-scrollbar {
		width: 8px;
	}

	.media-list::-webkit-scrollbar-track {
		background: #f1f1f1;
	}

	.media-list::-webkit-scrollbar-thumb {
		background: #bdc3c7;
		border-radius: 4px;
	}

	.media-list::-webkit-scrollbar-thumb:hover {
		background: #95a5a6;
	}
</style>
