# Voces de Catalina (ElevenLabs): hecho y pendiente

Cómo se hace cada palabra: generar en la web de ElevenLabs con Catalina (sin API), mover el mp3 a `data/voces/`, ponerlo en `voz` de la palabra, agregar la palabra y el mp3 a `PRECACHE` en `sw.js` y subir `VERSION`.

Las palabras de la lista ampliada (`data/voces/lista-ampliada.json`) se agregan al catálogo `data/vocabulario-inicial.json` a medida que tienen voz. Orden de trabajo: 1) catálogo actual, 2) prioridad 1, 3) prioridad 2, 4) prioridad 3.

**Total: 597 palabras, 88 con voz, 509 por generar.**

## Catálogo actual (48) (48/48 hechas)

**personas:** [x] mamá · [x] papá · [x] tata · [x] abuela · [x] bebé · [x] nene · [x] nena

**cuerpo:** [x] mano · [x] pie · [x] boca · [x] ojo · [x] nariz

**comida:** [x] pan · [x] agua · [x] leche · [x] sopa · [x] queso · [x] manzana · [x] plátano · [x] jugo

**casa:** [x] casa · [x] cama · [x] mesa · [x] silla · [x] taza · [x] puerta

**animales:** [x] perro · [x] gato · [x] pato · [x] vaca · [x] oso · [x] pez

**juguetes:** [x] pelota · [x] auto · [x] globo · [x] muñeca · [x] libro · [x] polera

**enlace:** [x] come · [x] bebe · [x] duerme · [x] juega · [x] es · [x] está · [x] tiene · [x] el · [x] la · [x] y

## Prioridad 1: lo más importante (40/243 hechas)

**enlace:** [x] yo · [x] tú · [x] mi · [x] un · [x] una · [x] no · [x] sí · [x] quiero · [x] dame · [x] ayuda · [x] mira · [x] ven · [x] vamos · [x] hola · [x] adiós · [x] gracias · [x] favor · [x] más · [x] ya · [x] aquí · [x] con · [x] de · [x] en · [x] a · [x] para · [x] que · [x] soy · [x] eres · [x] hay · [x] voy · [x] va · [x] me · [x] te · [x] se · [x] lo · [x] mucho · [x] muy · [x] ahora · [x] bien · [x] mal · [ ] también · [ ] pero · [ ] o · [ ] los · [ ] las · [ ] al · [ ] del · [ ] su · [ ] ella · [ ] este · [ ] eso · [ ] corre · [ ] salta · [ ] abre · [ ] cierra · [ ] canta · [ ] baila · [ ] lava · [ ] toma · [ ] sube · [ ] baja · [ ] llora · [ ] ríe · [ ] duele · [ ] grande · [ ] chico · [ ] lindo · [ ] feo · [ ] rico · [ ] caliente · [ ] frío · [ ] limpio · [ ] sucio · [ ] bueno · [ ] malo · [ ] feliz · [ ] triste

**personas:** [ ] hermano · [ ] hermana · [ ] tío · [ ] tía · [ ] amigo · [ ] amiga · [ ] niño · [ ] niña · [ ] profe · [ ] doctor · [ ] primo · [ ] prima

**cuerpo:** [ ] cara · [ ] pelo · [ ] oreja · [ ] dedo · [ ] brazo · [ ] pierna · [ ] panza · [ ] diente · [ ] lengua · [ ] cabeza

**comida:** [ ] arroz · [ ] huevo · [ ] carne · [ ] pollo · [ ] fruta · [ ] pera · [ ] uva · [ ] helado · [ ] galleta · [ ] torta · [ ] fideos · [ ] papas · [ ] tomate · [ ] zanahoria · [ ] naranja · [ ] durazno · [ ] sandía · [ ] frutilla · [ ] palta · [ ] limón · [ ] pizza · [ ] sal · [ ] azúcar · [ ] chocolate · [ ] dulce · [ ] café · [ ] yogur · [ ] jamón · [ ] mantequilla · [ ] bebida

**casa:** [ ] baño · [ ] cocina · [ ] patio · [ ] ventana · [ ] sofá · [ ] luz · [ ] tele · [ ] plato · [ ] vaso · [ ] cuchara · [ ] tenedor · [ ] cuchillo · [ ] olla · [ ] llave · [ ] techo · [ ] piso · [ ] pared · [ ] cortina · [ ] toalla · [ ] jabón · [ ] cepillo · [ ] ducha

**animales:** [ ] caballo · [ ] conejo · [ ] pájaro · [ ] pollito · [ ] mono · [ ] león · [ ] tigre · [ ] elefante · [ ] tortuga · [ ] ratón · [ ] oveja · [ ] chancho · [ ] gallina · [ ] mariposa · [ ] abeja · [ ] hormiga · [ ] araña · [ ] rana

**juguetes:** [ ] bici · [ ] osito · [ ] tren · [ ] avión · [ ] bote · [ ] lápiz · [ ] papel · [ ] mochila · [ ] zapato · [ ] calcetín · [ ] pantalón · [ ] chaqueta · [ ] gorro · [ ] polerón · [ ] vestido · [ ] sombrero · [ ] reloj · [ ] teléfono · [ ] celular · [ ] paraguas · [ ] moneda · [ ] plata · [ ] regalo · [ ] flor · [ ] árbol · [ ] sol · [ ] luna · [ ] estrella · [ ] nube · [ ] lluvia · [ ] mar · [ ] playa · [ ] plaza · [ ] calle · [ ] escuela · [ ] tienda · [ ] hospital · [ ] bus · [ ] micro · [ ] metro · [ ] camión · [ ] moto

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
