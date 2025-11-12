-- Query para auditar posts en idiomas asiáticos/no-latinos en BigQuery

-- 1. Detectar posts con caracteres chinos (más común)
SELECT
  COUNT(*) as total_posts_chino,
  name_proyecto,
  ARRAY_AGG(text LIMIT 5) as ejemplos_texto
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE REGEXP_CONTAINS(text, r'[\u4E00-\u9FFF]')  -- Caracteres chinos
  AND created >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY name_proyecto
ORDER BY total_posts_chino DESC;

-- 2. Detectar posts con caracteres japoneses
SELECT
  COUNT(*) as total_posts_japones,
  name_proyecto,
  ARRAY_AGG(text LIMIT 5) as ejemplos_texto
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE (
  REGEXP_CONTAINS(text, r'[\u3040-\u309F]')  -- Hiragana
  OR REGEXP_CONTAINS(text, r'[\u30A0-\u30FF]')  -- Katakana
)
AND created >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY name_proyecto
ORDER BY total_posts_japones DESC;

-- 3. Detectar posts con caracteres coreanos
SELECT
  COUNT(*) as total_posts_coreano,
  name_proyecto,
  ARRAY_AGG(text LIMIT 5) as ejemplos_texto
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE REGEXP_CONTAINS(text, r'[\uAC00-\uD7AF]')  -- Hangul
  AND created >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY name_proyecto
ORDER BY total_posts_coreano DESC;

-- 4. Detectar posts con caracteres árabes
SELECT
  COUNT(*) as total_posts_arabe,
  name_proyecto,
  ARRAY_AGG(text LIMIT 5) as ejemplos_texto
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE REGEXP_CONTAINS(text, r'[\u0600-\u06FF]')  -- Árabe
  AND created >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY name_proyecto
ORDER BY total_posts_arabe DESC;

-- 5. Detectar posts con caracteres tailandeses
SELECT
  COUNT(*) as total_posts_tailandes,
  name_proyecto,
  ARRAY_AGG(text LIMIT 5) as ejemplos_texto
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE REGEXP_CONTAINS(text, r'[\u0E00-\u0E7F]')  -- Tailandés
  AND created >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY name_proyecto
ORDER BY total_posts_tailandes DESC;

-- 6. Resumen general: detectar CUALQUIER idioma asiático
SELECT
  name_proyecto,
  COUNT(*) as total_posts_asiaticos,
  COUNT(DISTINCT source) as fuentes,
  MIN(created) as primer_post,
  MAX(created) as ultimo_post,
  ARRAY_AGG(DISTINCT CASE
    WHEN REGEXP_CONTAINS(text, r'[\u4E00-\u9FFF]') THEN 'Chino'
    WHEN REGEXP_CONTAINS(text, r'[\u3040-\u309F]') THEN 'Japonés (Hiragana)'
    WHEN REGEXP_CONTAINS(text, r'[\u30A0-\u30FF]') THEN 'Japonés (Katakana)'
    WHEN REGEXP_CONTAINS(text, r'[\uAC00-\uD7AF]') THEN 'Coreano'
    WHEN REGEXP_CONTAINS(text, r'[\u0600-\u06FF]') THEN 'Árabe'
    WHEN REGEXP_CONTAINS(text, r'[\u0E00-\u0E7F]') THEN 'Tailandés'
    ELSE 'Otro'
  END) as idiomas_detectados
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE (
  REGEXP_CONTAINS(text, r'[\u4E00-\u9FFF]') OR  -- Chino
  REGEXP_CONTAINS(text, r'[\u3040-\u309F]') OR  -- Japonés Hiragana
  REGEXP_CONTAINS(text, r'[\u30A0-\u30FF]') OR  -- Japonés Katakana
  REGEXP_CONTAINS(text, r'[\uAC00-\uD7AF]') OR  -- Coreano
  REGEXP_CONTAINS(text, r'[\u0600-\u06FF]') OR  -- Árabe
  REGEXP_CONTAINS(text, r'[\u0E00-\u0E7F]')     -- Tailandés
)
AND created >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY name_proyecto
ORDER BY total_posts_asiaticos DESC;

-- 7. Ver ejemplos específicos de posts asiáticos con todos los detalles
SELECT
  name_proyecto,
  source,
  text,
  link,
  user_name,
  created,
  CASE
    WHEN REGEXP_CONTAINS(text, r'[\u4E00-\u9FFF]') THEN 'Chino'
    WHEN REGEXP_CONTAINS(text, r'[\u3040-\u309F]') THEN 'Japonés (Hiragana)'
    WHEN REGEXP_CONTAINS(text, r'[\u30A0-\u30FF]') THEN 'Japonés (Katakana)'
    WHEN REGEXP_CONTAINS(text, r'[\uAC00-\uD7AF]') THEN 'Coreano'
    WHEN REGEXP_CONTAINS(text, r'[\u0600-\u06FF]') THEN 'Árabe'
    WHEN REGEXP_CONTAINS(text, r'[\u0E00-\u0E7F]') THEN 'Tailandés'
    ELSE 'Otro asiático'
  END as idioma_detectado
FROM `secom-359014.ProyectosTooldata.datav2`
WHERE (
  REGEXP_CONTAINS(text, r'[\u4E00-\u9FFF]') OR
  REGEXP_CONTAINS(text, r'[\u3040-\u309F]') OR
  REGEXP_CONTAINS(text, r'[\u30A0-\u30FF]') OR
  REGEXP_CONTAINS(text, r'[\uAC00-\uD7AF]') OR
  REGEXP_CONTAINS(text, r'[\u0600-\u06FF]') OR
  REGEXP_CONTAINS(text, r'[\u0E00-\u0E7F]')
)
AND created >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
ORDER BY created DESC
LIMIT 50;
