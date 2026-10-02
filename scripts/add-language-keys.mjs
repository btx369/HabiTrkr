/**
 * Adds the missing interface keys to the six languages the author is confident in.
 *
 * `nl`, `pl`, `tr`, `ja`, `zh` and `ko` are deliberately left untouched: their blocks do
 * not receive the new keys, and the lookup falls back to English for them until someone
 * translates them properly. Inventing translations for languages I cannot check would be
 * worse than an honest English fallback.
 *
 * Run once: node scripts/add-language-keys.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '..', 'src/contexts/LanguageContext.tsx');

/** [key, en, pt, es, fr, de, it] */
const KEYS = [
  // Tabs
  ['tabNotes', 'Notes', 'Notas', 'Notas', 'Notes', 'Notizen', 'Note'],
  ['tabFolders', 'Folders', 'Pastas', 'Carpetas', 'Dossiers', 'Ordner', 'Cartelle'],
  ['tabArchived', 'Archived', 'Arquivadas', 'Archivadas', 'Archivé', 'Archiviert', 'Archiviate'],
  ['tabTasks', 'Tasks', 'Tarefas', 'Tareas', 'Tâches', 'Aufgaben', 'Attività'],

  // Sorting and views
  ['all', 'All', 'Todas', 'Todas', 'Tout', 'Alle', 'Tutte'],
  ['view', 'View', 'Ver', 'Ver', 'Affichage', 'Ansicht', 'Vista'],
  ['sortBy', 'Sort by', 'Ordenar por', 'Ordenar por', 'Trier par', 'Sortieren nach', 'Ordina per'],
  ['dateCreated', 'Date Created', 'Data de criação', 'Fecha de creación', 'Date de création', 'Erstelldatum', 'Data di creazione'],
  ['dateModified', 'Date Modified', 'Data de modificação', 'Fecha de modificación', 'Date de modification', 'Änderungsdatum', 'Data di modifica'],
  ['title', 'Title', 'Título', 'Título', 'Titre', 'Titel', 'Titolo'],
  ['daysRemaining', 'Days Remaining', 'Dias restantes', 'Días restantes', 'Jours restants', 'Verbleibende Tage', 'Giorni rimanenti'],
  ['daysAgo', 'Days Ago', 'Dias atrás', 'Días atrás', 'Il y a des jours', 'Tage her', 'Giorni fa'],

  // Calendar
  ['dayView', 'Day', 'Dia', 'Día', 'Jour', 'Tag', 'Giorno'],
  ['weekView', 'Week', 'Semana', 'Semana', 'Semaine', 'Woche', 'Settimana'],
  ['monthView', 'Month', 'Mês', 'Mes', 'Mois', 'Monat', 'Mese'],
  ['noEvents', 'No events', 'Sem eventos', 'Sin eventos', 'Aucun événement', 'Keine Termine', 'Nessun evento'],
  ['dayMonday', 'Monday', 'Segunda', 'Lunes', 'Lundi', 'Montag', 'Lunedì'],
  ['dayTuesday', 'Tuesday', 'Terça', 'Martes', 'Mardi', 'Dienstag', 'Martedì'],
  ['dayWednesday', 'Wednesday', 'Quarta', 'Miércoles', 'Mercredi', 'Mittwoch', 'Mercoledì'],
  ['dayThursday', 'Thursday', 'Quinta', 'Jueves', 'Jeudi', 'Donnerstag', 'Giovedì'],
  ['dayFriday', 'Friday', 'Sexta', 'Viernes', 'Vendredi', 'Freitag', 'Venerdì'],
  ['daySaturday', 'Saturday', 'Sábado', 'Sábado', 'Samedi', 'Samstag', 'Sabato'],
  ['daySunday', 'Sunday', 'Domingo', 'Domingo', 'Dimanche', 'Sonntag', 'Domenica'],

  // Short day names for the calendar and habit weekday headers.
  //
  // These exist as their own keys rather than being sliced from the full names above.
  // Taking three characters works in English and Portuguese by luck, but German would
  // give "Die/Mit/Don/Fre/Sam/Son" where the language actually uses "Di/Mi/Do/Fr/Sa/So",
  // and Japanese and Korean have no meaningful abbreviation of a two-character weekday.
  // One key per language is the only way to get this right.
  ['dayShortMonday', 'Mon', 'Seg', 'Lun', 'Lun', 'Mo', 'Lun'],
  ['dayShortTuesday', 'Tue', 'Ter', 'Mar', 'Mar', 'Di', 'Mar'],
  ['dayShortWednesday', 'Wed', 'Qua', 'Mié', 'Mer', 'Mi', 'Mer'],
  ['dayShortThursday', 'Thu', 'Qui', 'Jue', 'Jeu', 'Do', 'Gio'],
  ['dayShortFriday', 'Fri', 'Sex', 'Vie', 'Ven', 'Fr', 'Ven'],
  ['dayShortSaturday', 'Sat', 'Sáb', 'Sáb', 'Sam', 'Sa', 'Sab'],
  ['dayShortSunday', 'Sun', 'Dom', 'Dom', 'Dim', 'So', 'Dom'],

  // Action menu
  ['pin', 'Pin', 'Fixar', 'Fijar', 'Épingler', 'Anheften', 'Fissa'],
  ['unpin', 'Unpin', 'Desafixar', 'Quitar', 'Détacher', 'Lösen', 'Rimuovi'],
  ['edit', 'Edit', 'Editar', 'Editar', 'Modifier', 'Bearbeiten', 'Modifica'],
  ['lock', 'Lock', 'Bloquear', 'Bloquear', 'Verrouiller', 'Sperren', 'Blocca'],
  ['unlock', 'Unlock', 'Desbloquear', 'Desbloquear', 'Déverrouiller', 'Entsperren', 'Sblocca'],
  ['share', 'Share', 'Partilhar', 'Compartir', 'Partager', 'Teilen', 'Condividi'],
  ['makeACopy', 'Make a Copy', 'Duplicar', 'Duplicar', 'Dupliquer', 'Kopie erstellen', 'Duplica'],
  ['moveToFolder', 'Move to Folder', 'Mover para pasta', 'Mover a carpeta', 'Déplacer vers un dossier', 'In Ordner verschieben', 'Sposta nella cartella'],
  ['archive', 'Archive', 'Arquivar', 'Archivar', 'Archiver', 'Archivieren', 'Archivia'],
  ['restore', 'Restore', 'Restaurar', 'Restaurar', 'Restaurer', 'Wiederherstellen', 'Ripristina'],
  ['color', 'Color', 'Cor', 'Color', 'Couleur', 'Farbe', 'Colore'],

  // Note types
  ['noteText', 'Text', 'Texto', 'Texto', 'Texte', 'Text', 'Testo'],
  ['noteList', 'List', 'Lista', 'Lista', 'Liste', 'Liste', 'Lista'],
  ['noteImage', 'Image', 'Imagem', 'Imagen', 'Image', 'Bild', 'Immagine'],
  ['noteAudio', 'Audio', 'Áudio', 'Audio', 'Audio', 'Audio', 'Audio'],

  // Creation
  ['createNote', 'Create Note', 'Criar nota', 'Crear nota', 'Créer une note', 'Notiz erstellen', 'Crea nota'],
  ['createFolder', 'Create Folder', 'Criar pasta', 'Crear carpeta', 'Créer un dossier', 'Ordner erstellen', 'Crea cartella'],
  ['createEvent', 'Create Event', 'Criar evento', 'Crear evento', 'Créer un événement', 'Termin erstellen', 'Crea evento'],
  ['createHabit', 'Create Habit', 'Criar hábito', 'Crear hábito', 'Créer une habitude', 'Gewohnheit erstellen', 'Crea abitudine'],

  // Editor and viewer labels
  ['setTime', 'Set time', 'Definir hora', 'Definir hora', 'Définir l’heure', 'Uhrzeit festlegen', 'Imposta ora'],
  ['allDay', 'All Day', 'Todo o dia', 'Todo el día', 'Toute la journée', 'Ganztägig', 'Tutto il giorno'],
  ['recurrentEvent', 'Recurrent Event', 'Evento recorrente', 'Evento recurrente', 'Événement récurrent', 'Wiederkehrender Termin', 'Evento ricorrente'],
  ['location', 'Location', 'Localização', 'Ubicación', 'Lieu', 'Ort', 'Luogo'],
  ['description', 'Description', 'Descrição', 'Descripción', 'Description', 'Beschreibung', 'Descrizione'],
  ['alert', 'Alert', 'Alerta', 'Alerta', 'Alerte', 'Erinnerung', 'Avviso'],
  ['addNote', 'Add note', 'Adicionar nota', 'Añadir nota', 'Ajouter une note', 'Notiz hinzufügen', 'Aggiungi nota'],
  ['editNote', 'Edit note', 'Editar nota', 'Editar nota', 'Modifier la note', 'Notiz bearbeiten', 'Modifica nota'],
  ['startWriting', 'Start writing...', 'Comece a escrever...', 'Empieza a escribir...', 'Commencez à écrire...', 'Schreiben beginnen...', 'Inizia a scrivere...'],

  // Empty states and misc
  ['noArchivedFolders', 'No archived folders', 'Sem pastas arquivadas', 'Sin carpetas archivadas', 'Aucun dossier archivé', 'Keine archivierten Ordner', 'Nessuna cartella archiviata'],
  ['notificationsOff', 'Notifications are off', 'Notificações desligadas', 'Notificaciones desactivadas', 'Notifications désactivées', 'Benachrichtigungen sind aus', 'Notifiche disattivate'],
  ['enableInSettings', 'Enable them in the app settings.', 'Ative-as nas definições da aplicação.', 'Actívalas en los ajustes de la aplicación.', 'Activez-les dans les réglages de l’application.', 'Aktiviere sie in den App-Einstellungen.', 'Attivale nelle impostazioni dell’app.'],
];

const COLUMNS = ['en', 'pt', 'es', 'fr', 'de', 'it'];

/*
 * Line endings are normalised before the lines are examined.
 *
 * The file is checked out with CRLF, so splitting on `\n` leaves a trailing `\r` on every
 * line — and a pattern anchored with `$` then never matches. That is why the first two
 * attempts reported success while inserting nothing: the block-start pattern is anchored,
 * the `'sunday'` one is not, so the language blocks were never recognised. The dictionary
 * is a plain object, so TypeScript does not police its keys and nothing complained either.
 * Output is written with `\n` throughout, matching how the file is stored in git.
 */
const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const lines = source.split('\n');
const out = [];
let current = null;
let insertedFor = new Set();

/*
 * The indentation is read from the file rather than assumed. A first attempt hardcoded
 * four spaces, but the blocks are indented six, so the insertion silently matched nothing
 * and the script reported success — the dictionary is a plain object, so TypeScript does
 * not police its keys and the mistake produced no error either.
 */
const BLOCK_START = /^(\s+)([a-z]{2}): \{$/;
const SUNDAY = /^(\s+)'sunday': /;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  out.push(line);

  const blockStart = BLOCK_START.exec(line);
  if (blockStart) { current = blockStart[2]; insertedFor = new Set(); continue; }

  const sunday = SUNDAY.exec(line);
  if (current && sunday && !insertedFor.has(current)) {
    insertedFor.add(current);
    const indent = sunday[1];
    const col = COLUMNS.indexOf(current);
    if (col === -1) {
      // A language we are not translating yet. The marker makes the gap visible instead of
      // letting the missing keys look like an oversight.
      out.push(`${indent}// Keys added after this point are not translated yet; \`t()\` falls back to English.`);
      continue;
    }
    out.push(`${indent}// --- Tabs, sorting, calendar, menus and editor labels. ---`);
    for (const entry of KEYS) {
      const key = entry[0];
      const value = entry[col + 1];
      if (value === undefined) throw new Error(`Missing "${current}" value for key ${key}`);
      out.push(`${indent}'${key}': ${JSON.stringify(value).replace(/"/g, "'")},`);
    }
  }
}

fs.writeFileSync(file, out.join('\n'));
console.log(`inserted ${KEYS.length} keys for ${COLUMNS.length} languages into ${path.relative(path.resolve(here, '..'), file)}`);
