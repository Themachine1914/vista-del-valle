# Instagram photo fetch

Instagram sirve login-wall para el perfil @vistadelvallecasabito y el post https://www.instagram.com/p/DcY3dYDkaD4/ (bistec encebollado). No hay CDN de platos accesible sin sesión de Instagram.

La carta usa ilustraciones de categoría en `public/images/placeholders/`.

Cuando el restaurante exporte o descargue sus fotos:

- `DcY3dYDkaD4` → `public/images/platos/bistec-encebollado.jpg`
- Resto de platos: `public/images/platos/{id}.jpg` (ids en prisma/catalog.ts)
- Re-seed, o subir cada foto desde /admin → Platos
