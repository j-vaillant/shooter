// Importer express et socket.io
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const { endianness } = require("os");

// Créer l'application Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir les fichiers statiques du dossier 'public'
app.use(express.static(path.join(__dirname, "public")));

// Liste des joueurs, leurs noms et leurs scores
let players = {};
let scores = {}; // Suivi des scores des joueurs
let readyPlayers = {}; // Enregistre les joueurs prêts
let enemy = null; // L'ennemi actuellement affiché

// Fonction pour créer un ennemi avec une position aléatoire
function spawnEnemy(clientWidth, clientHeight) {
  if (enemy) return; // Si un ennemi est déjà en cours, on n'en crée pas un autre

  const radius = 30;
  const x = Math.random() * (clientWidth - radius * 2) + radius;
  const y = Math.random() * (clientHeight - radius * 2) + radius;

  // Créer un nouvel ennemi
  enemy = { x, y, radius, id: Date.now() };

  // Diffuser l'ennemi à tous les joueurs prêts
  console.log("ennemy sent");
  io.emit("enemy_spawned", enemy);

  // Supprimer l'ennemi après 2 secondes (ou tout autre délai)
  setTimeout(() => {
    if (enemy) {
      io.emit("enemy_destroyed", enemy.id);
    } // Détruire l'ennemi de tous les clients
    enemy = null; // Réinitialiser l'ennemi
  }, 1500); // L'ennemi disparaît après 2 secondes
}

// Créer un ennemi toutes les 5 secondes, mais un seul ennemi à la fois
setInterval(() => {
  if (!enemy && Object.keys(readyPlayers).length > 0) {
    // Créer un ennemi uniquement si des joueurs sont prêts
    io.sockets.emit("request_window_size"); // Demander aux clients la taille de la fenêtre pour générer l'ennemi
  }
}, 3000);

// Gérer les connexions des clients via WebSocket
io.on("connection", (socket) => {
  console.log("Un joueur s'est connecté :", socket.id);

  // Demander au joueur de saisir son nom via window.prompt
  socket.emit("request_name");

  // Lorsqu'un joueur envoie son nom, l'ajouter à la liste des joueurs
  socket.on("set_name", (name) => {
    players[socket.id] = name; // Ajouter le joueur à la liste
    readyPlayers[socket.id] = true; // Marquer ce joueur comme prêt
    scores[socket.id] = 0; // Initialiser le score à 0
    console.log(`${name} (${socket.id}) s'est connecté`);

    // Diffuser le leaderboard mis à jour
    io.emit("update_leaderboard", players, scores);

    // Si un ennemi existe déjà, l'envoyer au joueur
    if (enemy) {
      socket.emit("enemy_spawned", enemy);
    }
  });

  // Gérer la réception des dimensions de la fenêtre du client
  socket.on("window_size", (clientWidth, clientHeight) => {
    console.log(
      `Client connecté avec taille de fenêtre: ${clientWidth}x${clientHeight}`
    );
    spawnEnemy(clientWidth, clientHeight); // Demander la création d'un ennemi
  });

  // Gérer un clic sur un ennemi
  socket.on("enemy_clicked", (userEnemy) => {
    if (enemy && enemy.id === userEnemy.id) {
      // Vérifier si c'est bien l'ennemi actuel
      // Augmenter le score du joueur
      scores[socket.id]++;
      io.emit("update_leaderboard", players, scores); // Diffuser le leaderboard mis à jour
      io.emit("enemy_destroyed", userEnemy.id); // Supprimer l'ennemi
      enemy = null; // Réinitialiser l'ennemi
    }
  });

  // Gérer la déconnexion du joueur
  socket.on("disconnect", () => {
    console.log("Un joueur s'est déconnecté :", socket.id);

    // Retirer le joueur de la liste et diffuser le leaderboard mis à jour
    delete players[socket.id];
    delete readyPlayers[socket.id];
    delete scores[socket.id];
    io.emit("update_leaderboard", players, scores);
  });
});

const port = process.env.PORT || 3000;

// Démarrer le serveur sur le port 3000
server.listen(port, () => {
  console.log("Le serveur écoute sur http://localhost:3000");
});
