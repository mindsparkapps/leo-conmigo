# Leo Conmigo

PWA para que un niño con síndrome de Down aprenda a leer. La especificación completa está en [PLAN.md](PLAN.md): léela entera antes de escribir código.

- Trabaja una fase del §9 a la vez, en orden; ciérrala con su lista de aceptación y un commit antes de pasar a la siguiente.
- Las reglas pedagógicas del §2 y el motor de progreso del §4 son obligatorios: no los simplifiques ni cambies umbrales sin que el usuario lo pida.
- La lógica de `js/core/` es pura (sin DOM) y lleva pruebas: `npm test` (equivale a `node --test "tests/*.test.js"`; en Node 24 `node --test tests/` falla).
- App estática sin compilación, sin frameworks, interfaz y código en español.
- No hagas `git push`: el usuario sube los cambios.
- Si algo no está definido en el plan, pregunta.
