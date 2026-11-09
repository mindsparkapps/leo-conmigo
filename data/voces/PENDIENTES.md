# Voces de Catalina (ElevenLabs): hecho y pendiente

**Voz: Catalina, ID de voz ElevenLabs `5yNXxdAaHAkq8N8bGqwQ`** (modelo Eleven v4, estabilidad 50, similitud 75; cuenta del usuario). Usar siempre esta misma voz en los procesos futuros. Es voz de biblioteca: la API da 402 en plan gratuito, por eso se genera desde la web.

Cómo se hace cada palabra: generar en la web de ElevenLabs con Catalina (sin API), mover el mp3 a `data/voces/`, ponerlo en `voz` de la palabra, agregar la palabra y el mp3 a `PRECACHE` en `sw.js` y subir `VERSION`.

Las palabras de la lista ampliada (`data/voces/lista-ampliada.json`) se agregan al catálogo `data/vocabulario-inicial.json` a medida que tienen voz. Orden de trabajo: 1) catálogo actual, 2) prioridad 1, 3) prioridad 2, 4) prioridad 3.

**Total: 597 palabras, 232 con voz, 365 por generar.**

## Catálogo actual (48) (48/48 hechas)

**personas:** [x] mamá · [x] papá · [x] tata · [x] abuela · [x] bebé · [x] nene · [x] nena

**cuerpo:** [x] mano · [x] pie · [x] boca · [x] ojo · [x] nariz

**comida:** [x] pan · [x] agua · [x] leche · [x] sopa · [x] queso · [x] manzana · [x] plátano · [x] jugo

**casa:** [x] casa · [x] cama · [x] mesa · [x] silla · [x] taza · [x] puerta

**animales:** [x] perro · [x] gato · [x] pato · [x] vaca · [x] oso · [x] pez

**juguetes:** [x] pelota · [x] auto · [x] globo · [x] muñeca · [x] libro · [x] polera

**enlace:** [x] come · [x] bebe · [x] duerme · [x] juega · [x] es · [x] está · [x] tiene · [x] el · [x] la · [x] y

## Prioridad 1: lo más importante (184/243 hechas)

**enlace:** [x] yo · [x] tú · [x] mi · [x] un · [x] una · [x] no · [x] sí · [x] quiero · [x] dame · [x] ayuda · [x] mira · [x] ven · [x] vamos · [x] hola · [x] adiós · [x] gracias · [x] favor · [x] más · [x] ya · [x] aquí · [x] con · [x] de · [x] en · [x] a · [x] para · [x] que · [x] soy · [x] eres · [x] hay · [x] voy · [x] va · [x] me · [x] te · [x] se · [x] lo · [x] mucho · [x] muy · [x] ahora · [x] bien · [x] mal · [x] también · [x] pero · [x] o · [x] los · [x] las · [x] al · [x] del · [x] su · [x] ella · [x] este · [x] eso · [x] corre · [x] salta · [x] abre · [x] cierra · [x] canta · [x] baila · [x] lava · [x] toma · [x] sube · [x] baja · [x] llora · [x] ríe · [x] duele · [ ] grande · [ ] chico · [ ] lindo · [ ] feo · [ ] rico · [ ] caliente · [ ] frío · [ ] limpio · [ ] sucio · [ ] bueno · [ ] malo · [ ] feliz · [ ] triste

**personas:** [x] hermano · [x] hermana · [x] tío · [x] tía · [x] amigo · [x] amiga · [x] niño · [x] niña · [x] profe · [x] doctor · [x] primo · [x] prima

**cuerpo:** [x] cara · [x] pelo · [x] oreja · [x] dedo · [x] brazo · [x] pierna · [x] panza · [x] diente · [x] lengua · [x] cabeza

**comida:** [x] arroz · [x] huevo · [x] carne · [x] pollo · [x] fruta · [x] pera · [x] uva · [x] helado · [x] galleta · [x] torta · [x] fideos · [x] papas · [x] tomate · [x] zanahoria · [x] naranja · [x] durazno · [x] sandía · [x] frutilla · [x] palta · [x] limón · [x] pizza · [x] sal · [x] azúcar · [x] chocolate · [x] dulce · [x] café · [x] yogur · [x] jamón · [x] mantequilla · [x] bebida

**casa:** [x] baño · [x] cocina · [x] patio · [x] ventana · [x] sofá · [x] luz · [x] tele · [x] plato · [x] vaso · [x] cuchara · [x] tenedor · [x] cuchillo · [x] olla · [x] llave · [x] techo · [x] piso · [x] pared · [x] cortina · [x] toalla · [x] jabón · [x] cepillo · [x] ducha

**animales:** [x] caballo · [x] conejo · [x] pájaro · [x] pollito · [x] mono · [x] león · [x] tigre · [x] elefante · [x] tortuga · [x] ratón · [x] oveja · [x] chancho · [x] gallina · [x] mariposa · [x] abeja · [x] hormiga · [x] araña · [x] rana

**juguetes:** [x] bici · [x] osito · [x] tren · [x] avión · [x] bote · [x] lápiz · [x] papel · [x] mochila · [x] zapato · [x] calcetín · [x] pantalón · [x] chaqueta · [x] gorro · [x] polerón · [x] vestido · [x] sombrero · [x] reloj · [x] teléfono · [x] celular · [x] paraguas · [x] moneda · [x] plata · [x] regalo · [x] flor · [x] árbol · [x] sol · [x] luna · [x] estrella · [ ] nube · [ ] lluvia · [ ] mar · [ ] playa · [ ] plaza · [ ] calle · [ ] escuela · [ ] tienda · [ ] hospital · [ ] bus · [ ] micro · [ ] metro · [ ] camión · [ ] moto

**otras:** [ ] rojo · [ ] azul · [ ] verde · [ ] amarillo · [ ] blanco · [ ] negro · [ ] uno · [ ] dos · [ ] tres · [ ] cuatro · [ ] cinco · [ ] entrada · [ ] salida · [ ] abierto · [ ] cerrado · [ ] cuidado · [ ] peligro · [ ] pare · [ ] empujar · [ ] tirar · [ ] hombres · [ ] mujeres · [ ] precio · [ ] hambre · [ ] sed · [ ] sueño · [ ] calor · [ ] dolor · [ ] miedo · [ ] amor · [ ] perdón · [ ] permiso

## Prioridad 2 (0/255 hechas)

**enlace:** [ ] quién · [ ] dónde · [ ] cuál · [ ] cuánto · [ ] hoy · [ ] mañana · [ ] noche · [ ] día · [ ] tarde · [ ] hora · [ ] arriba · [ ] abajo · [ ] dentro · [ ] fuera · [ ] cerca · [ ] lejos · [ ] antes · [ ] después · [ ] siempre · [ ] nunca · [ ] todo · [ ] nada · [ ] algo · [ ] poco · [ ] así · [ ] ahí · [ ] allá · [ ] otro · [ ] otra · [ ] nos · [ ] le · [ ] ese · [ ] esa · [ ] esto · [ ] mío · [ ] tuyo · [ ] ni · [ ] sin · [ ] sobre · [ ] entre · [ ] hasta · [ ] desde · [ ] por · [ ] porque · [ ] cuando · [ ] solo · [ ] juntos · [ ] pide · [ ] usa · [ ] saca · [ ] tira · [ ] empuja · [ ] corta · [ ] lleva · [ ] trae · [ ] guarda · [ ] busca · [ ] encuentra · [ ] compra · [ ] paga · [ ] vende · [ ] cuida · [ ] ama · [ ] sabe · [ ] pasea · [ ] dibuja · [ ] pinta · [ ] lee · [ ] escribe · [ ] estudia · [ ] trabaja · [ ] viaja · [ ] cuenta · [ ] dice · [ ] llama · [ ] escucha · [ ] habla · [ ] vuela · [ ] cae · [ ] sale · [ ] entra · [ ] llega · [ ] viene · [ ] ve · [ ] da · [ ] pone · [ ] hace · [ ] quiere · [ ] puede · [ ] espera · [ ] ordena · [ ] siente · [ ] piensa · [ ] gusta · [ ] necesita · [ ] comparte · [ ] abraza · [ ] besa · [ ] saluda · [ ] limpia · [ ] despierta · [ ] levanta · [ ] baña · [ ] viste · [ ] peina · [ ] sienta · [ ] rápido · [ ] lento · [ ] alto · [ ] bajo · [ ] nuevo · [ ] viejo · [ ] lleno · [ ] vacío · [ ] duro · [ ] blando · [ ] mojado · [ ] seco · [ ] cansado · [ ] contento · [ ] enojado · [ ] asustado · [ ] enfermo · [ ] bonito · [ ] pequeño · [ ] largo · [ ] corto · [ ] listo

**personas:** [ ] bombero · [ ] policía · [ ] señor · [ ] señora · [ ] hombre · [ ] mujer · [ ] familia · [ ] gente

**cuerpo:** [ ] espalda · [ ] rodilla · [ ] codo · [ ] cuello · [ ] corazón · [ ] pecho · [ ] hombro

**comida:** [ ] ensalada · [ ] hamburguesa · [ ] completo · [ ] cebolla · [ ] lechuga · [ ] choclo · [ ] pastel · [ ] mermelada · [ ] aceite · [ ] desayuno · [ ] almuerzo · [ ] once · [ ] cena · [ ] pescado · [ ] harina · [ ] tostada

**casa:** [ ] dormitorio · [ ] jardín · [ ] reja · [ ] escalera · [ ] ropa · [ ] basura · [ ] fuego · [ ] horno · [ ] refri · [ ] lavadora · [ ] espejo · [ ] almohada · [ ] sábana · [ ] frazada · [ ] vela · [ ] lámpara · [ ] radio · [ ] escoba · [ ] balde · [ ] sartén · [ ] tetera · [ ] caja · [ ] bolsa

**animales:** [ ] culebra · [ ] lobo · [ ] zorro · [ ] jirafa · [ ] cebra · [ ] delfín · [ ] ballena · [ ] tiburón · [ ] pingüino · [ ] pavo · [ ] cabra · [ ] mosca · [ ] mosquito · [ ] gusano · [ ] caracol · [ ] loro · [ ] búho · [ ] perrito · [ ] gatito

**juguetes:** [ ] computador · [ ] cuaderno · [ ] tijera · [ ] goma · [ ] lentes · [ ] zapatilla · [ ] guante · [ ] bufanda · [ ] pijama · [ ] falda · [ ] camisa · [ ] cuento · [ ] canción · [ ] música · [ ] foto · [ ] dinero · [ ] columpio · [ ] tobogán · [ ] bloques · [ ] casco · [ ] cumpleaños · [ ] fiesta · [ ] navidad · [ ] viento · [ ] cinturón

**otras:** [ ] marrón · [ ] rosado · [ ] morado · [ ] gris · [ ] seis · [ ] siete · [ ] ocho · [ ] nueve · [ ] diez · [ ] cero · [ ] farmacia · [ ] panadería · [ ] almacén · [ ] supermercado · [ ] correo · [ ] banco · [ ] ambulancia · [ ] taxi · [ ] paradero · [ ] semáforo · [ ] ascensor · [ ] mercado · [ ] feria · [ ] menú · [ ] receta · [ ] mensaje · [ ] besos · [ ] abrazo · [ ] rabia

## Prioridad 3 (0/51 hechas)

**enlace:** [ ] mezcla · [ ] hierve · [ ] fríe · [ ] hornea · [ ] pela · [ ] bate · [ ] agrega · [ ] revuelve · [ ] sirve

**otras:** [ ] veinte · [ ] cien · [ ] lunes · [ ] martes · [ ] miércoles · [ ] jueves · [ ] viernes · [ ] sábado · [ ] domingo · [ ] semana · [ ] mes · [ ] año · [ ] verano · [ ] invierno · [ ] otoño · [ ] primavera

**casa:** [ ] sala · [ ] comedor · [ ] pasillo · [ ] cuarto · [ ] estufa · [ ] lavamanos · [ ] peineta · [ ] pañal · [ ] servilleta · [ ] mantel

**juguetes:** [ ] mapa · [ ] carta · [ ] diario · [ ] revista · [ ] cartel · [ ] letra · [ ] número · [ ] tablero · [ ] naipes · [ ] dado · [ ] trompo · [ ] cometa · [ ] autito · [ ] camioneta · [ ] barco · [ ] cohete

## Frases pendientes (hoy suenan con voz sintética)

- [ ] Te faltan N monedas (distintos montos)
- [ ] Ganaste N monedas (montos distintos de 10 y 13)
- [ ] Preguntas «¿Cuál es…?» de la etapa 0 (P3)
- [ ] Las 6 preguntas de los cuentos
- [ ] Sílabas sueltas de la actividad S1
- [ ] Nombres de premios que crea el adulto (no se pueden fijar de antemano)

Frases ya hechas (25): ver `js/frases-voz.js`.
