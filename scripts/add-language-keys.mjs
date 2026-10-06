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

  // --- Second pass: the labels inside the editors, which the first pass left in English.
  ['add', 'Add', 'Adicionar', 'Añadir', 'Ajouter', 'Hinzufügen', 'Aggiungi'],
  ['move', 'Move', 'Mover', 'Mover', 'Déplacer', 'Verschieben', 'Sposta'],
  ['custom', 'Custom', 'Personalizado', 'Personalizado', 'Personnalisé', 'Benutzerdefiniert', 'Personalizzato'],
  ['viewList', 'List', 'Lista', 'Lista', 'Liste', 'Liste', 'Elenco'],
  ['viewX2', '2 per row', '2 por linha', '2 por fila', '2 par ligne', '2 pro Zeile', '2 per riga'],
  ['viewX3', '3 per row', '3 por linha', '3 por fila', '3 par ligne', '3 pro Zeile', '3 per riga'],
  ['noteViewerTitle', 'Note', 'Nota', 'Nota', 'Note', 'Notiz', 'Nota'],
  ['noteViewerSubtitle', 'Note editor', 'Editor de notas', 'Editor de notas', 'Éditeur de note', 'Notiz-Editor', 'Editor note'],
  ['selectDate', 'Select date', 'Selecionar data', 'Seleccionar fecha', 'Choisir une date', 'Datum wählen', 'Seleziona data'],
  ['suggestions', 'Suggestions', 'Sugestões', 'Sugerencias', 'Suggestions', 'Vorschläge', 'Suggerimenti'],
  ['dateAndTime', 'Date and Time', 'Data e hora', 'Fecha y hora', 'Date et heure', 'Datum und Uhrzeit', 'Data e ora'],
  ['start', 'Start', 'Início', 'Inicio', 'Début', 'Beginn', 'Inizio'],
  ['end', 'End', 'Fim', 'Fin', 'Fin', 'Ende', 'Fine'],
  ['repeatEvery', 'Repeat every', 'Repetir a cada', 'Repetir cada', 'Répéter chaque', 'Wiederholen alle', 'Ripeti ogni'],
  ['onTheseDays', 'On these days', 'Nestes dias', 'En estos días', 'Ces jours-là', 'An diesen Tagen', 'In questi giorni'],
  ['before', 'before', 'antes', 'antes', 'avant', 'vorher', 'prima'],
  ['unitMinutes', 'minutes', 'minutos', 'minutos', 'minutes', 'Minuten', 'minuti'],
  ['unitHours', 'hours', 'horas', 'horas', 'heures', 'Stunden', 'ore'],
  ['unitDays', 'days', 'dias', 'días', 'jours', 'Tage', 'giorni'],
  ['unitWeeks', 'weeks', 'semanas', 'semanas', 'semaines', 'Wochen', 'settimane'],
  ['unitMonths', 'months', 'meses', 'meses', 'mois', 'Monate', 'mesi'],
  ['unitYears', 'years', 'anos', 'años', 'ans', 'Jahre', 'anni'],
  ['repeatDays', 'Day(s)', 'Dia(s)', 'Día(s)', 'Jour(s)', 'Tag(e)', 'Giorno(i)'],
  ['repeatWeeks', 'Week(s)', 'Semana(s)', 'Semana(s)', 'Semaine(s)', 'Woche(n)', 'Settimana(e)'],
  ['repeatMonths', 'Month(s)', 'Mês(es)', 'Mes(es)', 'Mois', 'Monat(e)', 'Mese(i)'],
  ['repeatYears', 'Year(s)', 'Ano(s)', 'Año(s)', 'An(s)', 'Jahr(e)', 'Anno(i)'],
  ['daysOfWeek', 'Days of the Week', 'Dias da semana', 'Días de la semana', 'Jours de la semaine', 'Wochentage', 'Giorni della settimana'],
  ['activeDays', 'Active Days', 'Dias ativos', 'Días activos', 'Jours actifs', 'Aktive Tage', 'Giorni attivi'],
  ['numberOfDays', 'Number of days', 'Número de dias', 'Número de días', 'Nombre de jours', 'Anzahl der Tage', 'Numero di giorni'],
  ['daysPerWeek', 'Days per week', 'Dias por semana', 'Días por semana', 'Jours par semaine', 'Tage pro Woche', 'Giorni a settimana'],
  ['daysPerWeekInline', 'days per week', 'dias por semana', 'días por semana', 'jours par semaine', 'Tage pro Woche', 'giorni a settimana'],
  ['timesADay', 'Times a day', 'Vezes por dia', 'Veces al día', 'Fois par jour', 'Male pro Tag', 'Volte al giorno'],
  ['timesPerDay', 'Times per day', 'Vezes por dia', 'Veces por día', 'Fois par jour', 'Male pro Tag', 'Volte al giorno'],
  ['timesPerDayInline', 'times per day', 'vezes por dia', 'veces por día', 'fois par jour', 'Male pro Tag', 'volte al giorno'],
  ['unlimitedTimes', 'Unlimited times', 'Vezes ilimitadas', 'Veces ilimitadas', 'Fois illimitées', 'Unbegrenzt oft', 'Volte illimitate'],
  ['changeTrackingMode', 'Change Tracking Mode?', 'Alterar o modo de registo?', '¿Cambiar el modo de registro?', 'Changer le mode de suivi ?', 'Verfolgungsmodus ändern?', 'Cambiare modalità di registrazione?'],
  ['modeChangeToUnlimited', 'Your completion count will be preserved. Today\u2019s completed status will be cleared since unlimited mode has no daily goal.', 'A sua contagem de conclusões será mantida. O estado de hoje será limpo, porque o modo ilimitado não tem objetivo diário.', 'Tu recuento de completados se mantendrá. El estado de hoy se borrará, porque el modo ilimitado no tiene objetivo diario.', 'Votre nombre de validations sera conservé. Le statut du jour sera effacé, car le mode illimité n’a pas d’objectif quotidien.', 'Deine Anzahl wird beibehalten. Der heutige Status wird gelöscht, da der unbegrenzte Modus kein Tagesziel hat.', 'Il tuo conteggio verrà mantenuto. Lo stato di oggi sarà azzerato, perché la modalità illimitata non ha un obiettivo giornaliero.'],
  ['modeChangeToGoal', 'Your completion count will be preserved. If it meets the new daily goal, today will be marked as complete.', 'A sua contagem de conclusões será mantida. Se atingir o novo objetivo diário, hoje será marcado como concluído.', 'Tu recuento de completados se mantendrá. Si alcanza el nuevo objetivo diario, hoy se marcará como completado.', 'Votre nombre de validations sera conservé. S’il atteint le nouvel objectif quotidien, la journée sera marquée comme terminée.', 'Deine Anzahl wird beibehalten. Erreicht sie das neue Tagesziel, wird heute als erledigt markiert.', 'Il tuo conteggio verrà mantenuto. Se raggiunge il nuovo obiettivo giornaliero, oggi sarà segnato come completato.'],
  ['archivedHabits', 'Archived Habits', 'Hábitos arquivados', 'Hábitos archivados', 'Habitudes archivées', 'Archivierte Gewohnheiten', 'Abitudini archiviate'],
  ['archivedEvents', 'Archived Events', 'Eventos arquivados', 'Eventos archivados', 'Événements archivés', 'Archivierte Termine', 'Eventi archiviati'],
  ['archivedFolders', 'Archived Folders', 'Pastas arquivadas', 'Carpetas archivadas', 'Dossiers archivés', 'Archivierte Ordner', 'Cartelle archiviate'],
  ['noArchivedHabits', 'No archived habits', 'Sem hábitos arquivados', 'Sin hábitos archivados', 'Aucune habitude archivée', 'Keine archivierten Gewohnheiten', 'Nessuna abitudine archiviata'],
  ['noArchivedEvents', 'No archived events', 'Sem eventos arquivados', 'Sin eventos archivados', 'Aucun événement archivé', 'Keine archivierten Termine', 'Nessun evento archiviato'],
  ['allNotes', 'All Notes', 'Todas as notas', 'Todas las notas', 'Toutes les notes', 'Alle Notizen', 'Tutte le note'],
  ['allEvents', 'All Events', 'Todos os eventos', 'Todos los eventos', 'Tous les événements', 'Alle Termine', 'Tutti gli eventi'],
  ['allHabits', 'All Habits', 'Todos os hábitos', 'Todos los hábitos', 'Toutes les habitudes', 'Alle Gewohnheiten', 'Tutte le abitudini'],
  ['allFolders', 'All Folders', 'Todas as pastas', 'Todas las carpetas', 'Tous les dossiers', 'Alle Ordner', 'Tutte le cartelle'],
  ['noItemsYet', 'Nothing here yet', 'Ainda não há nada', 'Aún no hay nada', 'Rien pour l’instant', 'Noch nichts vorhanden', 'Ancora nulla'],
  ['recentlyAdded', 'Recently Added', 'Adicionado recentemente', 'Añadido recientemente', 'Ajouté récemment', 'Kürzlich hinzugefügt', 'Aggiunto di recente'],
  ['noteCount', 'Note Count', 'Número de notas', 'Número de notas', 'Nombre de notes', 'Anzahl Notizen', 'Numero di note'],
  ['completionRate', 'Completion Rate', 'Taxa de conclusão', 'Tasa de finalización', 'Taux de réussite', 'Abschlussrate', 'Tasso di completamento'],
  ['habitCount', 'Habit Count', 'Número de hábitos', 'Número de hábitos', 'Nombre d’habitudes', 'Anzahl Gewohnheiten', 'Numero di abitudini'],
  ['hour', 'Hour', 'Hora', 'Hora', 'Heure', 'Stunde', 'Ora'],
  ['minute', 'Minute', 'Minuto', 'Minuto', 'Minute', 'Minute', 'Minuto'],
  ['selectTime', 'Select time', 'Selecionar hora', 'Seleccionar hora', 'Choisir l’heure', 'Uhrzeit wählen', 'Seleziona ora'],
  ['autoImportByTags', 'Auto-import by tags', 'Importar automaticamente por tags', 'Importar automáticamente por etiquetas', 'Import automatique par tags', 'Automatisch nach Tags importieren', 'Importa automaticamente per tag'],
  ['premiumFeature', 'Premium Feature', 'Funcionalidade premium', 'Función premium', 'Fonctionnalité premium', 'Premium-Funktion', 'Funzione premium'],
  ['premiumFeatureBody', '{feature} is a premium feature. Upgrade to unlock this functionality.', '{feature} é uma funcionalidade premium. Faça upgrade para desbloquear esta funcionalidade.', '{feature} es una función premium. Mejora tu plan para desbloquear esta funcionalidad.', '{feature} est une fonctionnalité premium. Passez à un forfait supérieur pour la débloquer.', '{feature} ist eine Premium-Funktion. Führe ein Upgrade durch, um sie freizuschalten.', '{feature} è una funzione premium. Esegui l’upgrade per sbloccare questa funzionalità.'],
  ['editNoteTitle', 'Edit Note', 'Editar nota', 'Editar nota', 'Modifier la note', 'Notiz bearbeiten', 'Modifica nota'],
  ['editEvent', 'Edit Event', 'Editar evento', 'Editar evento', 'Modifier l’événement', 'Termin bearbeiten', 'Modifica evento'],
  ['editHabit', 'Edit Habit', 'Editar hábito', 'Editar hábito', 'Modifier l’habitude', 'Gewohnheit bearbeiten', 'Modifica abitudine'],
  ['editFolder', 'Edit Folder', 'Editar pasta', 'Editar carpeta', 'Modifier le dossier', 'Ordner bearbeiten', 'Modifica cartella'],
  ['createNewFolder', 'Create New Folder', 'Criar nova pasta', 'Crear nueva carpeta', 'Créer un nouveau dossier', 'Neuen Ordner erstellen', 'Crea nuova cartella'],
  ['noFoldersAvailable', 'No folders available', 'Sem pastas disponíveis', 'Sin carpetas disponibles', 'Aucun dossier disponible', 'Keine Ordner verfügbar', 'Nessuna cartella disponibile'],
  ['noNotesInFolder', 'No notes in this folder yet', 'Ainda não há notas nesta pasta', 'Aún no hay notas en esta carpeta', 'Aucune note dans ce dossier', 'Noch keine Notizen in diesem Ordner', 'Ancora nessuna nota in questa cartella'],
  ['noHabitsInFolder', 'No habits in this folder yet', 'Ainda não há hábitos nesta pasta', 'Aún no hay hábitos en esta carpeta', 'Aucune habitude dans ce dossier', 'Noch keine Gewohnheiten in diesem Ordner', 'Ancora nessuna abitudine in questa cartella'],
  ['noEventsYet', 'No events yet', 'Ainda não há eventos', 'Aún no hay eventos', 'Aucun événement pour l’instant', 'Noch keine Termine', 'Ancora nessun evento'],
  ['noFoldersYet', 'No folders yet.', 'Ainda não há pastas.', 'Aún no hay carpetas.', 'Aucun dossier pour l’instant.', 'Noch keine Ordner.', 'Ancora nessuna cartella.'],
  ['noDateSet', 'No date set', 'Sem data definida', 'Sin fecha', 'Aucune date', 'Kein Datum', 'Nessuna data'],
  ['today', 'Today', 'Hoje', 'Hoy', 'Aujourd’hui', 'Heute', 'Oggi'],
  ['todayExclaim', 'Today!', 'Hoje!', '¡Hoy!', 'Aujourd’hui !', 'Heute!', 'Oggi!'],
  ['archivedNotes', 'Archived Notes', 'Notas arquivadas', 'Notas archivadas', 'Notes archivées', 'Archivierte Notizen', 'Note archiviate'],
  ['noArchivedNotes', 'No archived notes', 'Sem notas arquivadas', 'Sin notas archivadas', 'Aucune note archivée', 'Keine archivierten Notizen', 'Nessuna nota archiviata'],
  ['noMatchingNotes', 'No matching notes found.', 'Nenhuma nota correspondente.', 'No se encontraron notas coincidentes.', 'Aucune note correspondante.', 'Keine passenden Notizen gefunden.', 'Nessuna nota corrispondente.'],
  ['noMatchingEvents', 'No matching events found.', 'Nenhum evento correspondente.', 'No se encontraron eventos coincidentes.', 'Aucun événement correspondant.', 'Keine passenden Termine gefunden.', 'Nessun evento corrispondente.'],
  ['year', 'Year', 'Ano', 'Año', 'Année', 'Jahr', 'Anno'],
  ['maximum', 'Maximum', 'Máximo', 'Máximo', 'Maximum', 'Maximum', 'Massimo'],
  ['alertTime', 'Alert Time', 'Hora do alerta', 'Hora de la alerta', 'Heure de l’alerte', 'Uhrzeit der Erinnerung', 'Ora dell’avviso'],
  ['timeUnit', 'Time Unit', 'Unidade de tempo', 'Unidad de tiempo', 'Unité de temps', 'Zeiteinheit', 'Unità di tempo'],
  ['customAlert', 'Custom Alert', 'Alerta personalizado', 'Alerta personalizada', 'Alerte personnalisée', 'Benutzerdefinierte Erinnerung', 'Avviso personalizzato'],
  ['noEventsThisDay', 'No events for this day', 'Sem eventos neste dia', 'Sin eventos este día', 'Aucun événement ce jour-là', 'Keine Termine an diesem Tag', 'Nessun evento in questo giorno'],
  ['restoreAll', 'Restore All', 'Restaurar tudo', 'Restaurar todo', 'Tout restaurer', 'Alle wiederherstellen', 'Ripristina tutto'],
  ['folderOnly', 'Folder Only', 'Apenas a pasta', 'Solo la carpeta', 'Dossier uniquement', 'Nur der Ordner', 'Solo la cartella'],
  ['restoreFolder', 'Restore Folder', 'Restaurar pasta', 'Restaurar carpeta', 'Restaurer le dossier', 'Ordner wiederherstellen', 'Ripristina cartella'],
  ['deleteHabit', 'Delete Habit', 'Eliminar hábito', 'Eliminar hábito', 'Supprimer l’habitude', 'Gewohnheit löschen', 'Elimina abitudine'],
  ['archiveHabit', 'Archive Habit', 'Arquivar hábito', 'Archivar hábito', 'Archiver l’habitude', 'Gewohnheit archivieren', 'Archivia abitudine'],
  ['deleteFolder', 'Delete Folder', 'Eliminar pasta', 'Eliminar carpeta', 'Supprimer le dossier', 'Ordner löschen', 'Elimina cartella'],
  ['archiveFolder', 'Archive Folder', 'Arquivar pasta', 'Archivar carpeta', 'Archiver le dossier', 'Ordner archivieren', 'Archivia cartella'],
  ['deleteEventTitle', 'Delete Event', 'Eliminar evento', 'Eliminar evento', 'Supprimer l’événement', 'Termin löschen', 'Elimina evento'],
  ['deleteNoteTitle', 'Delete Note', 'Eliminar nota', 'Eliminar nota', 'Supprimer la note', 'Notiz löschen', 'Elimina nota'],
  ['deleteSelectedItems', 'Delete Selected Items', 'Eliminar itens selecionados', 'Eliminar elementos seleccionados', 'Supprimer la sélection', 'Ausgewählte löschen', 'Elimina elementi selezionati'],
  ['archiveSelectedItems', 'Archive Selected Items', 'Arquivar itens selecionados', 'Archivar elementos seleccionados', 'Archiver la sélection', 'Ausgewählte archivieren', 'Archivia elementi selezionati'],
  ['timesToday', '{count} times today', '{count} vezes hoje', '{count} veces hoy', '{count} fois aujourd’hui', '{count} Mal heute', '{count} volte oggi'],
  ['timesTodayOf', '{done}/{total} times today', '{done}/{total} vezes hoje', '{done}/{total} veces hoy', '{done}/{total} fois aujourd’hui', '{done}/{total} Mal heute', '{done}/{total} volte oggi'],
  ['daysThisWeek', '{done}/{total} days this week', '{done}/{total} dias esta semana', '{done}/{total} días esta semana', '{done}/{total} jours cette semaine', '{done}/{total} Tage diese Woche', '{done}/{total} giorni questa settimana'],
  ['done', 'Done', 'Concluído', 'Hecho', 'Terminé', 'Erledigt', 'Fatto'],
  ['markDone', 'Mark Done', 'Marcar como concluído', 'Marcar como hecho', 'Marquer comme terminé', 'Als erledigt markieren', 'Segna come fatto'],
  ['none', 'None', 'Nenhum', 'Ninguno', 'Aucun', 'Keine', 'Nessuno'],
  ['unitHour', 'hour', 'hora', 'hora', 'heure', 'Stunde', 'ora'],
  ['ok', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK'],
  ['every', 'Every', 'A cada', 'Cada', 'Tous les', 'Alle', 'Ogni'],
  ['maximumValue', 'Maximum: {value}', 'Máximo: {value}', 'Máximo: {value}', 'Maximum : {value}', 'Maximum: {value}', 'Massimo: {value}'],
  ['checkedItems', '{count} checked items', '{count} itens marcados', '{count} elementos marcados', '{count} éléments cochés', '{count} markierte Einträge', '{count} elementi selezionati'],
  ['listItemPlaceholder', 'List item...', 'Item da lista...', 'Elemento de la lista...', 'Élément de liste...', 'Listeneintrag...', 'Elemento della lista...'],
  ['searchInNote', 'Search in note...', 'Pesquisar na nota...', 'Buscar en la nota...', 'Rechercher dans la note...', 'In Notiz suchen...', 'Cerca nella nota...'],
  ['addTitle', 'Add a title', 'Adicionar um título', 'Añadir un título', 'Ajouter un titre', 'Titel hinzufügen', 'Aggiungi un titolo'],
  ['addTagsPlaceholder', 'Add tags (e.g., #work #project)', 'Adicionar tags (ex.: #trabalho #projeto)', 'Añadir etiquetas (ej.: #trabajo #proyecto)', 'Ajouter des tags (ex. : #travail #projet)', 'Tags hinzufügen (z. B. #arbeit #projekt)', 'Aggiungi tag (es.: #lavoro #progetto)'],
  ['enterNoteTitle', 'Enter note title...', 'Introduza o título da nota...', 'Introduce el título de la nota...', 'Saisir le titre de la note...', 'Notiztitel eingeben...', 'Inserisci il titolo della nota...'],
  ['noteImageAlt', 'Note image', 'Imagem da nota', 'Imagen de la nota', 'Image de la note', 'Notizbild', 'Immagine della nota'],
  ['placeholderEventTitle', 'e.g., Birthday party', 'ex.: Festa de aniversário', 'ej.: Fiesta de cumpleaños', 'ex. : Fête d’anniversaire', 'z. B. Geburtstagsfeier', 'es.: Festa di compleanno'],
  ['placeholderLocation', 'e.g., Conference Room A', 'ex.: Sala de reuniões A', 'ej.: Sala de reuniones A', 'ex. : Salle de réunion A', 'z. B. Besprechungsraum A', 'es.: Sala riunioni A'],
  ['placeholderEventDescription', 'Add more details about this event...', 'Adicione mais detalhes a este evento...', 'Añade más detalles sobre este evento...', 'Ajoutez plus de détails sur cet événement...', 'Weitere Details zu diesem Termin hinzufügen...', 'Aggiungi maggiori dettagli su questo evento...'],
  ['placeholderHabitName', 'e.g., Drink 8 glasses of water', 'ex.: Beber 8 copos de água', 'ej.: Beber 8 vasos de agua', 'ex. : Boire 8 verres d’eau', 'z. B. 8 Gläser Wasser trinken', 'es.: Bere 8 bicchieri d’acqua'],
  ['placeholderHabitDescription', 'Add more details about this habit...', 'Adicione mais detalhes a este hábito...', 'Añade más detalles sobre este hábito...', 'Ajoutez plus de détails sur cette habitude...', 'Weitere Details zu dieser Gewohnheit hinzufügen...', 'Aggiungi maggiori dettagli su questa abitudine...'],

  // --- Toasts.
  //
  // Each is a whole sentence with `{entity}` and `{count}` placeholders, rather than a verb
  // key joined to a noun key at the call site. Composing them would force every language
  // into English word order and into agreeing a past participle with a noun whose gender
  // differs per language — German alone needs "Termin gelöscht" (masculine) and "Notiz
  // gelöscht" (feminine), which no single verb form can satisfy.
  ['toastAdded', '{entity} added', '{entity} adicionado', '{entity} añadido', '{entity} ajouté', '{entity} hinzugefügt', '{entity} aggiunto'],
  ['toastUpdated', '{entity} updated', '{entity} atualizado', '{entity} actualizado', '{entity} mis à jour', '{entity} aktualisiert', '{entity} aggiornato'],
  ['toastDeleted', '{entity} deleted', '{entity} eliminado', '{entity} eliminado', '{entity} supprimé', '{entity} gelöscht', '{entity} eliminato'],
  ['toastArchived', '{entity} archived', '{entity} arquivado', '{entity} archivado', '{entity} archivé', '{entity} archiviert', '{entity} archiviato'],
  ['toastRestored', '{entity} restored', '{entity} restaurado', '{entity} restaurado', '{entity} restauré', '{entity} wiederhergestellt', '{entity} ripristinato'],
  ['toastCopied', '{entity} copied', '{entity} duplicado', '{entity} duplicado', '{entity} dupliqué', '{entity} kopiert', '{entity} duplicato'],
  ['toastPinned', '{entity} pinned', '{entity} fixado', '{entity} fijado', '{entity} épinglé', '{entity} angeheftet', '{entity} fissato'],
  ['toastUnpinned', '{entity} unpinned', '{entity} desafixado', '{entity} desfijado', '{entity} détaché', '{entity} gelöst', '{entity} rimosso'],
  ['toastAddedToArchive', '{entity} added to Archived', '{entity} adicionado ao arquivo', '{entity} añadido a Archivados', '{entity} ajouté aux archives', '{entity} zum Archiv hinzugefügt', '{entity} aggiunto all’archivio'],
  ['toastItemCount', '{count} item(s)', '{count} item(ns)', '{count} elemento(s)', '{count} élément(s)', '{count} Eintrag/Einträge', '{count} elemento/i'],
  ['toastColorApplied', 'Color applied to {count} item(s)', 'Cor aplicada a {count} item(ns)', 'Color aplicado a {count} elemento(s)', 'Couleur appliquée à {count} élément(s)', 'Farbe auf {count} Eintrag/Einträge angewendet', 'Colore applicato a {count} elemento/i'],
  ['toastCopyFailed', 'Failed to copy the content', 'Não foi possível copiar o conteúdo', 'No se pudo copiar el contenido', 'Échec de la copie du contenu', 'Inhalt konnte nicht kopiert werden', 'Impossibile copiare il contenuto'],
  ['toastContentCopied', 'Content copied to the clipboard', 'Conteúdo copiado para a área de transferência', 'Contenido copiado al portapapeles', 'Contenu copié dans le presse-papiers', 'Inhalt in die Zwischenablage kopiert', 'Contenuto copiato negli appunti'],
  ['toastFolderAndItemsArchived', 'Folder and its {items} archived', 'Pasta e {items} arquivados', 'Carpeta y sus {items} archivados', 'Dossier et ses {items} archivés', 'Ordner und {items} archiviert', 'Cartella e {items} archiviati'],
  ['toastFolderAndItemsRestored', 'Folder and its {items} restored', 'Pasta e {items} restaurados', 'Carpeta y sus {items} restaurados', 'Dossier et ses {items} restaurés', 'Ordner und {items} wiederhergestellt', 'Cartella e {items} ripristinati'],
  ['toastFolderAndItemsDeleted', 'Folder and its {items} deleted', 'Pasta e {items} eliminados', 'Carpeta y sus {items} eliminados', 'Dossier et ses {items} supprimés', 'Ordner und {items} gelöscht', 'Cartella e {items} eliminati'],
  ['toastPasteFixTag', 'Please fix the tag format before saving', 'Corrija o formato das tags antes de guardar', 'Corrige el formato de las etiquetas antes de guardar', 'Corrigez le format des tags avant d’enregistrer', 'Bitte das Tag-Format vor dem Speichern korrigieren', 'Correggi il formato dei tag prima di salvare'],
  ['toastTagMustStartWithHash', 'Tags must start with # (e.g., #work #project)', 'As tags têm de começar por # (ex.: #trabalho #projeto)', 'Las etiquetas deben empezar por # (ej.: #trabajo #proyecto)', 'Les tags doivent commencer par # (ex. : #travail #projet)', 'Tags müssen mit # beginnen (z. B. #arbeit #projekt)', 'I tag devono iniziare con # (es.: #lavoro #progetto)'],
  ['toastTagLimit', 'Maximum {count} tags allowed', 'Máximo de {count} tags', 'Máximo {count} etiquetas', 'Maximum {count} tags', 'Maximal {count} Tags', 'Massimo {count} tag'],
  ['toastEndBeforeStart', 'The end date cannot be before the start date', 'A data de fim não pode ser anterior à de início', 'La fecha de fin no puede ser anterior a la de inicio', 'La date de fin ne peut pas précéder la date de début', 'Das Enddatum darf nicht vor dem Startdatum liegen', 'La data di fine non può precedere quella di inizio'],
  ['toastCheckedItems', '{count} checked item(s)', '{count} item(ns) marcado(s)', '{count} elemento(s) marcado(s)', '{count} élément(s) coché(s)', '{count} Eintrag/Einträge markiert', '{count} elemento/i selezionato/i'],
  ['confirm', 'Confirm', 'Confirmar', 'Confirmar', 'Confirmer', 'Bestätigen', 'Conferma'],
  ['confirmDeleteTitle', 'Delete this item?', 'Eliminar este item?', '¿Eliminar este elemento?', 'Supprimer cet élément ?', 'Diesen Eintrag löschen?', 'Eliminare questo elemento?'],
  ['confirmArchiveTitle', 'Archive this item?', 'Arquivar este item?', '¿Archivar este elemento?', 'Archiver cet élément ?', 'Diesen Eintrag archivieren?', 'Archiviare questo elemento?'],
  ['confirmDeleteBody', 'This action cannot be undone.', 'Esta ação não pode ser anulada.', 'Esta acción no se puede deshacer.', 'Cette action est irréversible.', 'Diese Aktion kann nicht rückgängig gemacht werden.', 'Questa azione non può essere annullata.'],
  ['setPinCode', 'Set PIN Code', 'Definir código PIN', 'Definir código PIN', 'Définir le code PIN', 'PIN-Code festlegen', 'Imposta codice PIN'],
  ['enterPinCode', 'Enter PIN Code', 'Introduza o código PIN', 'Introduce el código PIN', 'Saisir le code PIN', 'PIN-Code eingeben', 'Inserisci il codice PIN'],
  ['pinCreateHint', 'Create a 4-digit PIN to lock this note', 'Crie um PIN de 4 dígitos para bloquear esta nota', 'Crea un PIN de 4 dígitos para bloquear esta nota', 'Créez un code PIN à 4 chiffres pour verrouiller cette note', 'Erstelle einen 4-stelligen PIN, um diese Notiz zu sperren', 'Crea un PIN di 4 cifre per bloccare questa nota'],
  ['pinIncorrect', 'Incorrect PIN', 'PIN incorreto', 'PIN incorrecto', 'Code PIN incorrect', 'Falscher PIN', 'PIN errato'],
  ['setPin', 'Set PIN', 'Definir PIN', 'Definir PIN', 'Définir le PIN', 'PIN festlegen', 'Imposta PIN'],
  ['unlock', 'Unlock', 'Desbloquear', 'Desbloquear', 'Déverrouiller', 'Entsperren', 'Sblocca'],
  ['noNotesInFolderYet', 'No notes in this folder yet', 'Ainda não há notas nesta pasta', 'Aún no hay notas en esta carpeta', 'Aucune note dans ce dossier', 'Noch keine Notizen in diesem Ordner', 'Ancora nessuna nota in questa cartella'],
  ['placeholderFolderTitle', 'Enter folder title...', 'Introduza o título da pasta...', 'Introduce el título de la carpeta...', 'Saisir le titre du dossier...', 'Ordnertitel eingeben...', 'Inserisci il titolo della cartella...'],
  ['placeholderFolderDescription', 'Enter folder description...', 'Introduza a descrição da pasta...', 'Introduce la descripción de la carpeta...', 'Saisir la description du dossier...', 'Ordnerbeschreibung eingeben...', 'Inserisci la descrizione della cartella...'],
  ['placeholderEnterTitle', 'Enter title...', 'Introduza o título...', 'Introduce el título...', 'Saisir le titre...', 'Titel eingeben...', 'Inserisci il titolo...'],
  ['placeholderAddTagsWork', 'Add tags (e.g., #work #personal)', 'Adicionar tags (ex.: #trabalho #pessoal)', 'Añadir etiquetas (ej.: #trabajo #personal)', 'Ajouter des tags (ex. : #travail #personnel)', 'Tags hinzufügen (z. B. #arbeit #privat)', 'Aggiungi tag (es.: #lavoro #personale)'],
  ['placeholderAddTagsMeeting', 'Add tags (e.g., #meeting #work)', 'Adicionar tags (ex.: #reuniao #trabalho)', 'Añadir etiquetas (ej.: #reunion #trabajo)', 'Ajouter des tags (ex. : #réunion #travail)', 'Tags hinzufügen (z. B. #meeting #arbeit)', 'Aggiungi tag (es.: #riunione #lavoro)'],

  // --- Counted bulk actions.
  //
  // The count is what lets someone notice they archived three folders when they meant to
  // archive one, so it has to be IN the sentence rather than dropped. Every entry is a
  // `…One` / `…Many` pair because the number changes more than the noun in most languages:
  // Portuguese needs "1 nota arquivada" against "2 notas arquivadas", where both the
  // quantifier and the participle change. English only changes the noun, which is why a
  // single "{count} items archived" looked sufficient and is not.
  ['bulkArchivedOne', '{count} item archived', '{count} item arquivado', '{count} elemento archivado', '{count} élément archivé', '{count} Eintrag archiviert', '{count} elemento archiviato'],
  ['bulkArchivedMany', '{count} items archived', '{count} itens arquivados', '{count} elementos archivados', '{count} éléments archivés', '{count} Einträge archiviert', '{count} elementi archiviati'],
  ['bulkDeletedOne', '{count} item deleted', '{count} item eliminado', '{count} elemento eliminado', '{count} élément supprimé', '{count} Eintrag gelöscht', '{count} elemento eliminato'],
  ['bulkDeletedMany', '{count} items deleted', '{count} itens eliminados', '{count} elementos eliminados', '{count} éléments supprimés', '{count} Einträge gelöscht', '{count} elementi eliminati'],
  ['bulkRestoredOne', '{count} item restored', '{count} item restaurado', '{count} elemento restaurado', '{count} élément restauré', '{count} Eintrag wiederhergestellt', '{count} elemento ripristinato'],
  ['bulkRestoredMany', '{count} items restored', '{count} itens restaurados', '{count} elementos restaurados', '{count} éléments restaurés', '{count} Einträge wiederhergestellt', '{count} elementi ripristinati'],
  ['bulkCopiedOne', '{count} item copied', '{count} item duplicado', '{count} elemento duplicado', '{count} élément dupliqué', '{count} Eintrag kopiert', '{count} elemento duplicato'],
  ['bulkCopiedMany', '{count} items copied', '{count} itens duplicados', '{count} elementos duplicados', '{count} éléments dupliqués', '{count} Einträge kopiert', '{count} elementi duplicati'],
  ['bulkUpdatedOne', '{count} item updated', '{count} item atualizado', '{count} elemento actualizado', '{count} élément mis à jour', '{count} Eintrag aktualisiert', '{count} elemento aggiornato'],
  ['bulkUpdatedMany', '{count} items updated', '{count} itens atualizados', '{count} elementos actualizados', '{count} éléments mis à jour', '{count} Einträge aktualisiert', '{count} elementi aggiornati'],
  ['bulkMovedOne', '{count} item moved to a folder', '{count} item movido para uma pasta', '{count} elemento movido a una carpeta', '{count} élément déplacé vers un dossier', '{count} Eintrag in einen Ordner verschoben', '{count} elemento spostato in una cartella'],
  ['bulkMovedMany', '{count} items moved to a folder', '{count} itens movidos para uma pasta', '{count} elementos movidos a una carpeta', '{count} éléments déplacés vers un dossier', '{count} Einträge in einen Ordner verschoben', '{count} elementi spostati in una cartella'],

  // --- Named confirmations and the remaining badges.
  //
  // The confirmations said only "Delete this item?" with the noun, so a user could not tell
  // which item they were about to lose. The name is back in the sentence, with `{name}`
  // substituted by the title — or, for a note that has none, by its opening words.
  //
  // `%Q%` is the quote character. Written literally it would nest inside the string that
  // holds this list, which `sync-language-keys.mjs` parses; the marker is substituted on the
  // way into the dictionary.
  ['confirmDeleteNamed', 'Delete %Q%{name}%Q%?', 'Eliminar %Q%{name}%Q%?', '¿Eliminar %Q%{name}%Q%?', 'Supprimer %Q%{name}%Q% ?', '%Q%{name}%Q% löschen?', 'Eliminare %Q%{name}%Q%?'],
  ['confirmArchiveNamed', 'Archive %Q%{name}%Q%?', 'Arquivar %Q%{name}%Q%?', '¿Archivar %Q%{name}%Q%?', 'Archiver %Q%{name}%Q% ?', '%Q%{name}%Q% archivieren?', 'Archiviare %Q%{name}%Q%?'],
  ['confirmDeleteNamedBody', '%Q%{name}%Q% will be deleted. This cannot be undone.', '%Q%{name}%Q% será eliminado. Isto não pode ser anulado.', '%Q%{name}%Q% se eliminará. Esto no se puede deshacer.', '%Q%{name}%Q% sera supprimé. Action irréversible.', '%Q%{name}%Q% wird gelöscht. Das kann nicht rückgängig gemacht werden.', '%Q%{name}%Q% sarà eliminato. L’azione non può essere annullata.'],
  ['confirmArchiveNamedBody', '%Q%{name}%Q% will be moved to the archive. You can restore it later.', '%Q%{name}%Q% será movido para o arquivo. Pode restaurá-lo mais tarde.', '%Q%{name}%Q% se moverá al archivo. Podrás restaurarlo después.', '%Q%{name}%Q% sera déplacé vers les archives. Vous pourrez le restaurer plus tard.', '%Q%{name}%Q% wird ins Archiv verschoben. Du kannst es später wiederherstellen.', '%Q%{name}%Q% sarà spostato nell’archivio. Potrai ripristinarlo in seguito.'],
  ['untitledItem', 'Untitled', 'Sem título', 'Sin título', 'Sans titre', 'Ohne Titel', 'Senza titolo'],
  ['daysCountOne', '{count} day', '{count} dia', '{count} día', '{count} jour', '{count} Tag', '{count} giorno'],
  ['daysCountMany', '{count} days', '{count} dias', '{count} días', '{count} jours', '{count} Tage', '{count} giorni'],
  ['daysAgoBadgeOne', '{count} day ago', '{count} dia atrás', '{count} día atrás', 'il y a {count} jour', 'vor {count} Tag', '{count} giorno fa'],
  ['daysAgoBadgeMany', '{count} days ago', '{count} dias atrás', '{count} días atrás', 'il y a {count} jours', 'vor {count} Tagen', '{count} giorni fa'],
  ['noEventsInFolder', 'No events in this folder yet', 'Ainda não há eventos nesta pasta', 'Aún no hay eventos en esta carpeta', 'Aucun événement dans ce dossier', 'Noch keine Termine in diesem Ordner', 'Ancora nessun evento in questa cartella'],
  ['folderAndCountArchived', 'Folder and {count_label} archived', 'Pasta e {count_label} arquivados', 'Carpeta y {count_label} archivados', 'Dossier et {count_label} archivés', 'Ordner und {count_label} archiviert', 'Cartella e {count_label} archiviati'],
  ['folderAndCountDeleted', 'Folder and {count_label} deleted', 'Pasta e {count_label} eliminados', 'Carpeta y {count_label} eliminados', 'Dossier et {count_label} supprimés', 'Ordner und {count_label} gelöscht', 'Cartella e {count_label} eliminati'],
  ['entityNoteOne', 'note', 'nota', 'nota', 'note', 'Notiz', 'nota'],
  ['entityNoteMany', 'notes', 'notas', 'notas', 'notes', 'Notizen', 'note'],
  ['entityEventOne', 'event', 'evento', 'evento', 'événement', 'Termin', 'evento'],
  ['entityEventMany', 'events', 'eventos', 'eventos', 'événements', 'Termine', 'eventi'],
  ['entityHabitOne', 'habit', 'hábito', 'hábito', 'habitude', 'Gewohnheit', 'abitudine'],
  ['entityHabitMany', 'habits', 'hábitos', 'hábitos', 'habitudes', 'Gewohnheiten', 'abitudini'],
  ['entityFolderOne', 'folder', 'pasta', 'carpeta', 'dossier', 'Ordner', 'cartella'],
  ['entityFolderMany', 'folders', 'pastas', 'carpetas', 'dossiers', 'Ordner', 'cartelle'],
  ['folderAndCountRestored', 'Folder and {count_label} restored', 'Pasta e {count_label} restaurados', 'Carpeta y {count_label} restaurados', 'Dossier et {count_label} restaurés', 'Ordner und {count_label} wiederhergestellt', 'Cartella e {count_label} ripristinati'],
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
