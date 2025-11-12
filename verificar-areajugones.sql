-- Verificar posts de areajugones y otros medios españoles

-- 1. Ver cuántos posts hay de areajugones
SELECT
  COUNT(*) as total_posts,
  name_proyecto,
  MIN(created) as primer_post,
  MAX(created) as ultimo_post
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE LOWER(link) LIKE '%areajugones%' OR LOWER(link) LIKE '%sport.es%'
GROUP BY name_proyecto
ORDER BY total_posts DESC;

-- 2. Ver ejemplos de posts de areajugones
SELECT
  name_proyecto,
  text,
  link,
  created,
  source,
  user_name
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE LOWER(link) LIKE '%areajugones%' OR LOWER(link) LIKE '%sport.es%'
ORDER BY created DESC
LIMIT 20;

-- 3. Buscar TODOS los dominios españoles (.es)
SELECT
  REGEXP_EXTRACT(link, r'https?://(?:www\.)?([^/]+)') as dominio,
  COUNT(*) as total_posts,
  name_proyecto,
  ARRAY_AGG(DISTINCT text LIMIT 3) as ejemplos_texto
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE LOWER(link) LIKE '%.es/%' OR LOWER(link) LIKE '%.es'
GROUP BY dominio, name_proyecto
ORDER BY total_posts DESC
LIMIT 50;

-- 4. Identificar dominios no chilenos (sin .cl)
SELECT
  REGEXP_EXTRACT(link, r'https?://(?:www\.)?([^/]+)') as dominio,
  COUNT(*) as total_posts,
  COUNT(DISTINCT name_proyecto) as proyectos
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE link IS NOT NULL
  AND link != ''
  AND LOWER(link) NOT LIKE '%.cl%'
  AND LOWER(link) NOT LIKE '%twitter.com%'
  AND LOWER(link) NOT LIKE '%facebook.com%'
  AND LOWER(link) NOT LIKE '%instagram.com%'
  AND LOWER(link) NOT LIKE '%tiktok.com%'
GROUP BY dominio
HAVING total_posts > 10  -- Solo dominios con varios posts
ORDER BY total_posts DESC
LIMIT 100;
