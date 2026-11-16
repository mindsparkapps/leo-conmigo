# Voces de Catalina (ElevenLabs): hecho y pendiente

**Voz: Catalina, ID de voz ElevenLabs `5yNXxdAaHAkq8N8bGqwQ`** (modelo Eleven v4, estabilidad 50, similitud 75; cuenta del usuario). Usar siempre esta misma voz en los procesos futuros. Es voz de biblioteca: la API da 402 en plan gratuito, por eso se genera desde la web.

Cómo se hace cada palabra: generar en la web de ElevenLabs con Catalina (sin API), mover el mp3 a `data/voces/`, ponerlo en `voz` de la palabra, agregar la palabra y el mp3 a `PRECACHE` en `sw.js` y subir `VERSION`.

Las palabras de la lista ampliada (`data/voces/lista-ampliada.json`) se agregan al catálogo `data/vocabulario-inicial.json` a medida que tienen voz. Orden de trabajo: 1) catálogo actual, 2) prioridad 1, 3) prioridad 2, 4) prioridad 3.

**Total: 597 palabras, 597 con voz, 0 por generar.**

## Catálogo actual (48) (48/48 hechas)

**personas:** [x] mamá · [x] papá · [x] tata · [x] abuela · [x] bebé · [x] nene · [x] nena

**cuerpo:** [x] mano · [x] pie · [x] boca · [x] ojo · [x] nariz

**comida:** [x] pan · [x] agua · [x] leche · [x] sopa · [x] queso · [x] manzana · [x] plátano · [x] jugo

**casa:** [x] casa · [x] cama · [x] mesa · [x] silla · [x] taza · [x] puerta

**animales:** [x] perro · [x] gato · [x] pato · [x] vaca · [x] oso · [x] pez

**juguetes:** [x] pelota · [x] auto · [x] globo · [x] muñeca · [x] libro · [x] polera

**enlace:** [x] come · [x] bebe · [x] duerme · [x] juega · [x] es · [x] está · [x] tiene · [x] el · [x] la · [x] y

## Prioridad 1: lo más importante (243/243 hechas)

**enlace:** [x] yo · [x] tú · [x] mi · [x] un · [x] una · [x] no · [x] sí · [x] quiero · [x] dame · [x] ayuda · [x] mira · [x] ven · [x] vamos · [x] hola · [x] adiós · [x] gracias · [x] favor · [x] más · [x] ya · [x] aquí · [x] con · [x] de · [x] en · [x] a · [x] para · [x] que · [x] soy · [x] eres · [x] hay · [x] voy · [x] va · [x] me · [x] te · [x] se · [x] lo · [x] mucho · [x] muy · [x] ahora · [x] bien · [x] mal · [x] también · [x] pero · [x] o · [x] los · [x] las · [x] al · [x] del · [x] su · [x] ella · [x] este · [x] eso · [x] corre · [x] salta · [x] abre · [x] cierra · [x] canta · [x] baila · [x] lava · [x] toma · [x] sube · [x] baja · [x] llora · [x] ríe · [x] duele · [x] grande · [x] chico · [x] lindo · [x] feo · [x] rico · [x] caliente · [x] frío · [x] limpio · [x] sucio · [x] bueno · [x] malo · [x] feliz · [x] triste

**personas:** [x] hermano · [x] hermana · [x] tío · [x] tía · [x] amigo · [x] amiga · [x] niño · [x] niña · [x] profe · [x] doctor · [x] primo · [x] prima

**cuerpo:** [x] cara · [x] pelo · [x] oreja · [x] dedo · [x] brazo · [x] pierna · [x] panza · [x] diente · [x] lengua · [x] cabeza

**comida:** [x] arroz · [x] huevo · [x] carne · [x] pollo · [x] fruta · [x] pera · [x] uva · [x] helado · [x] galleta · [x] torta · [x] fideos · [x] papas · [x] tomate · [x] zanahoria · [x] naranja · [x] durazno · [x] sandía · [x] frutilla · [x] palta · [x] limón · [x] pizza · [x] sal · [x] azúcar · [x] chocolate · [x] dulce · [x] café · [x] yogur · [x] jamón · [x] mantequilla · [x] bebida

**casa:** [x] baño · [x] cocina · [x] patio · [x] ventana · [x] sofá · [x] luz · [x] tele · [x] plato · [x] vaso · [x] cuchara · [x] tenedor · [x] cuchillo · [x] olla · [x] llave · [x] techo · [x] piso · [x] pared · [x] cortina · [x] toalla · [x] jabón · [x] cepillo · [x] ducha

**animales:** [x] caballo · [x] conejo · [x] pájaro · [x] pollito · [x] mono · [x] león · [x] tigre · [x] elefante · [x] tortuga · [x] ratón · [x] oveja · [x] chancho · [x] gallina · [x] mariposa · [x] abeja · [x] hormiga · [x] araña · [x] rana

**juguetes:** [x] bici · [x] osito · [x] tren · [x] avión · [x] bote · [x] lápiz · [x] papel · [x] mochila · [x] zapato · [x] calcetín · [x] pantalón · [x] chaqueta · [x] gorro · [x] polerón · [x] vestido · [x] sombrero · [x] reloj · [x] teléfono · [x] celular · [x] paraguas · [x] moneda · [x] plata · [x] regalo · [x] flor · [x] árbol · [x] sol · [x] luna · [x] estrella · [x] nube · [x] lluvia · [x] mar · [x] playa · [x] plaza · [x] calle · [x] escuela · [x] tienda · [x] hospital · [x] bus · [x] micro · [x] metro · [x] camión · [x] moto

**otras:** [x] rojo · [x] azul · [x] verde · [x] amarillo · [x] blanco · [x] negro · [x] uno · [x] dos · [x] tres · [x] cuatro · [x] cinco · [x] entrada · [x] salida · [x] abierto · [x] cerrado · [x] cuidado · [x] peligro · [x] pare · [x] empujar · [x] tirar · [x] hombres · [x] mujeres · [x] precio · [x] hambre · [x] sed · [x] sueño · [x] calor · [x] dolor · [x] miedo · [x] amor · [x] perdón · [x] permiso

## Prioridad 2 (255/255 hechas)

**enlace:** [x] quién · [x] dónde · [x] cuál · [x] cuánto · [x] hoy · [x] mañana · [x] noche · [x] día · [x] tarde · [x] hora · [x] arriba · [x] abajo · [x] dentro · [x] fuera · [x] cerca · [x] lejos · [x] antes · [x] después · [x] siempre · [x] nunca · [x] todo · [x] nada · [x] algo · [x] poco · [x] así · [x] ahí · [x] allá · [x] otro · [x] otra · [x] nos · [x] le · [x] ese · [x] esa · [x] esto · [x] mío · [x] tuyo · [x] ni · [x] sin · [x] sobre · [x] entre · [x] hasta · [x] desde · [x] por · [x] porque · [x] cuando · [x] solo · [x] juntos · [x] pide · [x] usa · [x] saca · [x] tira · [x] empuja · [x] corta · [x] lleva · [x] trae · [x] guarda · [x] busca · [x] encuentra · [x] compra · [x] paga · [x] vende · [x] cuida · [x] ama · [x] sabe · [x] pasea · [x] dibuja · [x] pinta · [x] lee · [x] escribe · [x] estudia · [x] trabaja · [x] viaja · [x] cuenta · [x] dice · [x] llama · [x] escucha · [x] habla · [x] vuela · [x] cae · [x] sale · [x] entra · [x] llega · [x] viene · [x] ve · [x] da · [x] pone · [x] hace · [x] quiere · [x] puede · [x] espera · [x] ordena · [x] siente · [x] piensa · [x] gusta · [x] necesita · [x] comparte · [x] abraza · [x] besa · [x] saluda · [x] limpia · [x] despierta · [x] levanta · [x] baña · [x] viste · [x] peina · [x] sienta · [x] rápido · [x] lento · [x] alto · [x] bajo · [x] nuevo · [x] viejo · [x] lleno · [x] vacío · [x] duro · [x] blando · [x] mojado · [x] seco · [x] cansado · [x] contento · [x] enojado · [x] asustado · [x] enfermo · [x] bonito · [x] pequeño · [x] largo · [x] corto · [x] listo

**personas:** [x] bombero · [x] policía · [x] señor · [x] señora · [x] hombre · [x] mujer · [x] familia · [x] gente

**cuerpo:** [x] espalda · [x] rodilla · [x] codo · [x] cuello · [x] corazón · [x] pecho · [x] hombro

**comida:** [x] ensalada · [x] hamburguesa · [x] completo · [x] cebolla · [x] lechuga · [x] choclo · [x] pastel · [x] mermelada · [x] aceite · [x] desayuno · [x] almuerzo · [x] once · [x] cena · [x] pescado · [x] harina · [x] tostada

**casa:** [x] dormitorio · [x] jardín · [x] reja · [x] escalera · [x] ropa · [x] basura · [x] fuego · [x] horno · [x] refri · [x] lavadora · [x] espejo · [x] almohada · [x] sábana · [x] frazada · [x] vela · [x] lámpara · [x] radio · [x] escoba · [x] balde · [x] sartén · [x] tetera · [x] caja · [x] bolsa

**animales:** [x] culebra · [x] lobo · [x] zorro · [x] jirafa · [x] cebra · [x] delfín · [x] ballena · [x] tiburón · [x] pingüino · [x] pavo · [x] cabra · [x] mosca · [x] mosquito · [x] gusano · [x] caracol · [x] loro · [x] búho · [x] perrito · [x] gatito

**juguetes:** [x] computador · [x] cuaderno · [x] tijera · [x] goma · [x] lentes · [x] zapatilla · [x] guante · [x] bufanda · [x] pijama · [x] falda · [x] camisa · [x] cuento · [x] canción · [x] música · [x] foto · [x] dinero · [x] columpio · [x] tobogán · [x] bloques · [x] casco · [x] cumpleaños · [x] fiesta · [x] navidad · [x] viento · [x] cinturón

**otras:** [x] marrón · [x] rosado · [x] morado · [x] gris · [x] seis · [x] siete · [x] ocho · [x] nueve · [x] diez · [x] cero · [x] farmacia · [x] panadería · [x] almacén · [x] supermercado · [x] correo · [x] banco · [x] ambulancia · [x] taxi · [x] paradero · [x] semáforo · [x] ascensor · [x] mercado · [x] feria · [x] menú · [x] receta · [x] mensaje · [x] besos · [x] abrazo · [x] rabia

## Prioridad 3 (51/51 hechas)

**enlace:** [x] mezcla · [x] hierve · [x] fríe · [x] hornea · [x] pela · [x] bate · [x] agrega · [x] revuelve · [x] sirve

**otras:** [x] veinte · [x] cien · [x] lunes · [x] martes · [x] miércoles · [x] jueves · [x] viernes · [x] sábado · [x] domingo · [x] semana · [x] mes · [x] año · [x] verano · [x] invierno · [x] otoño · [x] primavera

**casa:** [x] sala · [x] comedor · [x] pasillo · [x] cuarto · [x] estufa · [x] lavamanos · [x] peineta · [x] pañal · [x] servilleta · [x] mantel

**juguetes:** [x] mapa · [x] carta · [x] diario · [x] revista · [x] cartel · [x] letra · [x] número · [x] tablero · [x] naipes · [x] dado · [x] trompo · [x] cometa · [x] autito · [x] camioneta · [x] barco · [x] cohete

## Frases pendientes (hoy suenan con voz sintética)

- [ ] Te faltan N monedas (distintos montos)
- [ ] Ganaste N monedas (montos distintos de 10 y 13)
- [ ] Preguntas «¿Cuál es…?» de la etapa 0 (P3)
- [ ] Las 6 preguntas de los cuentos
- [ ] Sílabas sueltas de la actividad S1
- [ ] Nombres de premios que crea el adulto (no se pueden fijar de antemano)

Frases ya hechas (25): ver `js/frases-voz.js`.
