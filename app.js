const cck = require("./cck");
const cron = require("node-cron");
const express = require("express");
const app = express();
const cckRoutes = require("./routes/cck");
const bodyParser = require("body-parser");
const sendPushNotification = require("./functions/sendPushNotification");

app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
app.use(express.json());

// Funciones
const scrapeAndSave = async () => {
  let eventos = [];
  await cck.init();
  eventos = await cck.scrapeEventos();
  await cck.guardarEventos(eventos);
  await syncReservasYEventos();
  cck.cerrar();
};
const syncReservasYEventos = async () => {
  console.log("🐣 Fetcheando reservas...");
  let reservas = await cck.fetchReservasPendientes();
  console.log("🐣 Fetcheando eventos...");
  let eventos = await cck.fetchEventos();
  console.log("🐣 Procesando...");
  let keys = Object.keys(reservas);
  let arrReservas = [];
  for (let key of keys) {
    arrReservas.push(reservas[key]);
  }
  keys = Object.keys(eventos);
  let arrEventos = [];
  for (let key of keys) {
    arrEventos.push(eventos[key]);
  }
  let nuevoArrEventos = [];
  for (let reserva of arrReservas) {
    nuevoArrEventos = arrEventos.map(evento => {
      if (reserva.nombre === evento.nombre && reserva.fecha === evento.fecha) {
        return { ...evento, estado: "agendado" };
      }
      return evento;
    });
  }
  console.log("🐣 Guarrrrdando...");
  await cck.guardarEventos(nuevoArrEventos);
  console.log("🍻 Sincronizado.");
  let payload = {
    title: "Eventos actualizados!",
    content: "Hay nuevos eventos disponibles"
  };
  sendPushNotification(payload);
};

// Headers
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Routes
app.use("/", cckRoutes);

// Manual
// scrapeAndSave();
// syncReservasYEventos();
// cck.reservarEntradasAgendadas();

// CRON!
const mainTime = "01 12 * * 2-4";

cron.schedule(
  mainTime,
  async () => {
    console.log("🐣 Reservas!");
    try {
      await cck.reservarEntradasAgendadas();
    } catch (err) {
      console.log("💩 ERROR!", err.message);
    }
  },
  {
    timezone: "America/Argentina/Buenos_Aires"
  }
);
let scrapeTime = "05 12 * * *";

cron.schedule(
  scrapeTime,
  async () => {
    console.log("🐣 Scrappin' time!");
    try {
      await scrapeAndSave();
    } catch (err) {
      console.log("💩 ERROR!", err.message);
    }
  },
  {
    timezone: "America/Argentina/Buenos_Aires"
  }
);

const port = process.env.PORT || 5000;

app.listen(port, () => console.log("Listening on port", port));
