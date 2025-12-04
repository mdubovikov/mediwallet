# MediWallet - Verwaltung medizinischer Testergebnisse 2

Eine mobile Anwendung zur Verwaltung und Speicherung medizinischer Testergebnisse mit lokaler Datenbankspeicherung.

## 🚀 Funktionen

- **Neue Tests scannen**: Fotos aufnehmen oder Bilder von medizinischen Testergebnissen hochladen
- **Lokale Speicherung**: Alle Daten werden lokal mit SQLite + Dateisystem gespeichert
- **Testergebnisse anzeigen**: Alle gespeicherten Testergebnisse in einer Liste durchsuchen
- **Testdetails**: Detaillierte Informationen für jeden Test anzeigen
- **Bearbeiten & Löschen**: Testinformationen aktualisieren oder alte Ergebnisse entfernen
- **Dunkler Modus**: Automatisches Theme-Wechseln

## 📱 Installation & Einrichtung

### Voraussetzungen
- Node.js (v18.19.1 oder höher empfohlen)
- npm oder yarn
- Expo CLI
- iOS Simulator, Android Emulator oder Expo Go App auf Ihrem Gerät

### Abhängigkeiten installieren

```bash
cd /home/shurik/Projects/mediwallet
npm install
```

### Anwendung ausführen

```bash
# Entwicklungsserver starten
npm start

# Oder auf spezifischer Plattform ausführen
npm run android  # Auf Android ausführen
npm run ios      # Auf iOS ausführen (nur macOS)
npm run web      # Im Webbrowser ausführen
```

## 🗄️ Datenbankstruktur

### SQLite-Schema

```sql
CREATE TABLE test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  test_type TEXT NOT NULL,
  image_path TEXT NOT NULL,
  results TEXT,
  notes TEXT,
  analyzed_data TEXT
);
```

### Dateispeicherung

Bilder werden im Dokumentenverzeichnis des Geräts gespeichert:
```
{DocumentDirectory}/medical_tests/test_TIMESTAMP.jpg
```

## 📂 Projektstruktur

```
mediwallet/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx           # Startbildschirm mit Hauptaktionen
│   │   └── explore.tsx         # Erkunden-Tab
│   ├── test-results.tsx        # Liste aller Testergebnisse
│   ├── test-detail/
│   │   └── [id].tsx            # Detaillierte Ansicht eines Testergebnisses
│   └── _layout.tsx             # Root-Layout mit DB-Initialisierung
├── components/                  # Wiederverwendbare UI-Komponenten
├── hooks/
│   └── use-database.ts         # Datenbank-Initialisierungs-Hook
├── services/
│   └── database.ts             # Datenbankoperationen & Dateiverwaltung
├── types/
│   └── test-result.ts          # TypeScript-Interfaces
└── constants/                  # Theme und Konstanten

```

## 🔧 Wichtige Komponenten

### Datenbank-Service (`services/database.ts`)

Hauptfunktionen:
- `initDatabase()` - SQLite-Datenbank initialisieren
- `saveImage(uri)` - Bild in permanenten Speicher speichern
- `addTestResult(data)` - Neues Testergebnis hinzufügen
- `getAllTestResults()` - Alle Testergebnisse abrufen
- `getTestResultById(id)` - Spezifisches Testergebnis abrufen
- `updateTestResult(id, updates)` - Testergebnis aktualisieren
- `deleteTestResult(id)` - Testergebnis und Bild löschen
- `getDatabaseStats()` - Datenbankstatistiken abrufen

### Hauptbildschirme

#### Startbildschirm (`app/(tabs)/index.tsx`)
- Drei Hauptaktions-Buttons:
  1. **Testergebnisse aufrufen** - Zur Listenansicht navigieren
  2. **Neuen Test scannen** - Foto aufnehmen oder aus Galerie wählen
  3. **Gesundheitsstatus analysieren** - (In Kürze verfügbar)

#### Testergebnisse-Liste (`app/test-results.tsx`)
- Zeigt alle gespeicherten Testergebnisse
- Zum Aktualisieren nach unten ziehen
- Zum Anzeigen der Details tippen

#### Test-Detailansicht (`app/test-detail/[id].tsx`)
- Vollständiges Bild anzeigen
- Testtyp und Notizen bearbeiten
- Testergebnis löschen

## 🔐 Erforderliche Berechtigungen

Die App benötigt folgende Berechtigungen:

- **Kamera**: Zum Aufnehmen von Fotos der Testergebnisse
- **Medienbibliothek**: Zum Auswählen vorhandener Fotos

Berechtigungen werden automatisch angefordert, wenn sie benötigt werden.

## 📊 Datenfluss

1. Benutzer nimmt Foto auf oder wählt aus Galerie
2. Bild wird in permanenten Speicher kopiert (`medical_tests/` Verzeichnis)
3. Metadaten werden in SQLite-Datenbank gespeichert
4. Benutzer kann Testergebnisse anzeigen, bearbeiten oder löschen
5. Beim Löschen werden sowohl Datenbankeintrag als auch Bilddatei entfernt

## 🎨 Anpassung

### Theme-Farben

Hauptfarben sind in den Komponenten definiert:
- Primär: `#4A90E2` (Blau)
- Sekundär: `#50C878` (Grün)
- Akzent: `#9B59B6` (Lila)

### Testtypen

Standard-Testtyp ist "Allgemeine Untersuchung". Sie können dies anpassen in:
- `app/(tabs)/index.tsx` - `saveTestResult()` Funktion

## 🚧 Zukünftige Verbesserungen

- [ ] OCR für Textextraktion aus Bildern
- [ ] Gesundheitsstatus-Analyse basierend auf Testergebnissen
- [ ] Datenexport (PDF, CSV)
- [ ] Cloud-Backup und Synchronisation
- [ ] Testergebnis-Trends und Diagramme
- [ ] Erinnerungen für periodische Tests
- [ ] Mehrere Benutzerprofile
- [ ] Such- und Filterfunktionalität

## 🐛 Fehlerbehebung

### Datenbank initialisiert nicht
- Konsolenprotokolle auf Fehler überprüfen
- App-Daten löschen und neu installieren

### Bilder werden nicht angezeigt
- Dateiberechtigungen überprüfen
- Bildpfad in Datenbank verifizieren

### Build-Fehler
- `npm install` erneut ausführen
- Cache löschen: `npm start --clear`

## 📝 Lizenz

Privates Projekt

## 👨‍💻 Entwicklung

Um neue Funktionen hinzuzufügen:

1. Datenbankschema in `services/database.ts` bei Bedarf aktualisieren
2. Neue Typen in `types/` hinzufügen
3. Neue Bildschirme in `app/` erstellen
4. Navigation bei Bedarf aktualisieren

## 🔄 Datenbank-Migrationen

Wenn Sie die Datenbankstruktur ändern müssen:

1. Schema in `initDatabase()` aktualisieren
2. Migrationslogik bei Bedarf erstellen
3. Datenerhaltung für bestehende Benutzer berücksichtigen

## 📱 Unterstützte Plattformen

- ✅ iOS (14.0+)
- ✅ Android (API 21+)
- ✅ Web (eingeschränkte Funktionalität)

## 🛠️ Tech Stack

- **Framework**: React Native mit Expo
- **Navigation**: Expo Router
- **Datenbank**: expo-sqlite
- **Dateisystem**: expo-file-system
- **Bildauswahl**: expo-image-picker
- **Sprache**: TypeScript
