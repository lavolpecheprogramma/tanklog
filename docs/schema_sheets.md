# TankLog — Storage architecture (Google Sheets + Google Drive)

This document defines the **full, unambiguous data storage architecture** for **TankLog**.

## Source of truth

This document is the **source of truth** for TankLog storage.
If any other document or implementation disagrees with it, it must be updated to match this document.

TankLog is **frontend-only**: there is no custom backend and no proprietary database.
All persistent data lives in the user’s own Google account:

- **Google Drive**: folders + uploaded photo files
- **Google Sheets**: structured tabular data per tank

If you change the storage model, this document must be updated first.

---

## General storage rules (required)

1. There is **ONE** root folder for the app, named **`TankLog`**.
2. The location of the `TankLog` folder:
   - **MUST** be chosen by the user
   - **MAY** be automatically created by the app **after user confirmation**
3. Inside the `TankLog` folder, there is **ONE subfolder per tank**.
4. Each tank folder is **fully self-contained**. Data is **never shared** across tanks.

---

## Google Drive structure (required)

TankLog uses the user’s Google Drive. Folder names and sheet names are **case-sensitive**.

The expected Drive layout is:

```text
<user-chosen-location>/
 └── TankLog/
     ├── Tank_<tank_id>_<tank_name>/
     │    ├── tank_data.xlsx (Google Sheet)
     │    ├── photos/
     │    │    ├── tank/
     │    │    └── livestock/
     │    └── README.txt (optional, human-readable notes)
     └── Tank_<tank_id>_<tank_name>/
          └── ...
```

### Naming rules

- **`tank_id`**:
  - Stable identifier for a tank (never changes after creation).
  - Allowed characters: `a–z`, `0–9`, `-` (hyphen), `_` (underscore).
  - Recommended format: lowercase kebab-case (example: `reef-300l`).
- **`tank_name`** (in folder name):
  - Human-friendly name.
  - The folder segment MUST be sanitized to be filesystem-safe:
    - Replace spaces with `_`
    - Remove characters outside `a–z`, `A–Z`, `0–9`, `_`, `-`
    - Keep it reasonably short (recommended max 50 chars)

### Drive invariants

- The `TankLog/` root folder contains **only tank folders**.
- Each `Tank_<tank_id>_<tank_name>/` folder contains:
  - Exactly **one** Google Sheets file: `tank_data.xlsx`
  - A `photos/` folder with the subfolders listed above
  - Optional `README.txt`
- Photo files are stored in Drive; structured metadata is stored in the tank sheet (`PHOTOS` tab).

---

## Google Sheets — per-tank file (required)

Each tank has **ONE** Google Sheets file stored inside its tank folder:

- **File name**: `tank_data.xlsx` (file type: Google Spreadsheet; `.xlsx` is the display name)
- **Scope**: this file is the **single source of truth** for that tank’s data

### Shared conventions (applies to every sheet)

- **Sheet names are exact** and case-sensitive.
- **Row 1** MUST contain the header with the exact column names listed below.
- **No merged cells**, no multi-row headers.
- **Dates**:
  - Use **ISO 8601** strings.
  - For timestamps, use UTC with milliseconds (example: `2026-01-19T10:00:00.000Z`).
  - For “date-only” fields, use `YYYY-MM-DD` (example: `2026-01-19`).
- **IDs** are strings generated client-side and MUST be unique within their sheet.
- Optional fields may be blank.

---

### SHEET: `TANK_INFO`

**Purpose**: store the tank’s identity and static metadata.

**Row model**: **one row only** (row 2). TankLog reads/writes row 2.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable tank id (must match the folder’s `<tank_id>`) |
| `name` | string | yes | Human-friendly name |
| `type` | string | yes | One of: `freshwater`, `planted`, `marine`, `reef` |
| `volume_liters` | number | no | Tank volume in liters |
| `start_date` | string | no | Date-only (`YYYY-MM-DD`) |
| `notes` | string | no | Free text |

**Invariants**

- `id` MUST match the tank folder name segment.
- There MUST be exactly one data row (row 2). Rows 3+ must be empty.

---

### SHEET: `WATER_TESTS`

**Purpose**: record water measurements using a measurement-based model.

**Model**: **one row = one measurement of one parameter**.

**Rules**

- Tests may be partial.
- A “test session” may include multiple parameters; TankLog writes multiple rows sharing the same `test_group_id` and `date`.
- Missing measurements are represented by **missing rows**, not blank cells.
- New measurements can only use parameters defined in `PARAMETER_RANGES` for the same tank.
- The `unit` is derived from `PARAMETER_RANGES.unit` for the selected parameter (source of truth).

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Unique measurement id (client-generated) |
| `test_group_id` | string | yes | Shared by all measurements taken in the same session |
| `date` | string | yes | ISO timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `parameter` | string | yes | Must be present in `PARAMETER_RANGES.parameter` (same tank). Example: `pH`, `KH`, `NO3`, `PO4` |
| `value` | number | yes | Numeric value |
| `unit` | string | yes | Unit label (must match `PARAMETER_RANGES.unit` for the parameter). Example: `dKH`, `ppm`, `mg/L`, `°C` |
| `method` | string | no | Optional test kit / method |
| `note` | string | no | Optional free text |

**Example (two parameters in one session)**

| id | test_group_id | date | parameter | value | unit | method | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `m_1` | `tg_1` | `2026-01-19T10:00:00.000Z` | `pH` | 8.1 | `pH` | `Salifert` |  |
| `m_2` | `tg_1` | `2026-01-19T10:00:00.000Z` | `KH` | 7.5 | `dKH` | `Salifert` |  |

---

### SHEET: `EVENTS`

**Purpose**: track all actions and interventions on the tank.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Unique event id (client-generated) |
| `date` | string | yes | ISO timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `type` | string | yes | One of: `water_change`, `dosing`, `maintenance`, `livestock_addition`, `livestock_removal` |
| `description` | string | yes | Short human description |
| `quantity` | number | no | Numeric quantity (if applicable) |
| `unit` | string | no | Unit for `quantity` (example: `L`, `ml`, `g`) |
| `product` | string | no | Product name (if dosing/maintenance) |
| `note` | string | no | Optional free text |

---

### SHEET: `REMINDERS`

**Purpose**: track recurring or one-time tasks (water changes, dosing, maintenance) and their next due date.
When a reminder is marked **done**, TankLog can automatically create a matching row in `EVENTS` (client-side).

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Unique reminder id (client-generated) |
| `title` | string | yes | Short human title (used as the event `description` when logging) |
| `next_due` | string | yes | ISO timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `repeat_every_days` | number | no | Blank = one-time reminder; if set must be > 0 |
| `last_done` | string | no | ISO timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `notes` | string | no | Optional free text (used as the event `note` when logging) |
| `event_type` | string | yes | One of: `water_change`, `dosing`, `maintenance`, `livestock_addition`, `livestock_removal` |
| `quantity` | number | no | Numeric quantity (if applicable) |
| `unit` | string | no | Unit for `quantity` (example: `L`, `ml`, `g`) |
| `product` | string | no | Product name (if dosing/maintenance) |

**Behavior**

- A reminder is **overdue** if `next_due` is before now.
- A reminder is **due today** if `next_due` is today (user’s local date).
- A reminder is **upcoming** if `next_due` is after today.
- If `event_type` is set, marking a reminder as **done** SHOULD create one row in `EVENTS` with:
  - `date`: the done timestamp
  - `type`: `REMINDERS.event_type`
  - `description`: `REMINDERS.title`
  - `quantity`, `unit`, `product`: from the reminder row
  - `note`: `REMINDERS.notes`

**Legacy note**

- Older spreadsheets may contain `next_due` / `last_done` as date-only (`YYYY-MM-DD`).
- TankLog reads both formats; new reminders are saved as full ISO timestamps (UTC).
- Older spreadsheets may be missing the `event_type` / `quantity` / `unit` / `product` columns; TankLog will add the headers and treat missing values as empty.

---

### SHEET: `LIVESTOCK`

**Purpose**: unified biological inventory (fish, corals, invertebrates, plants).
One row = one living entity (or colony / specimen).

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `livestock_id` | string | yes | Unique livestock id (client-generated) |
| `name_common` | string | yes | Common name |
| `name_scientific` | string | no | Scientific name (optional) |
| `category` | string | yes | One of: `fish`, `coral`, `invertebrate`, `plant` |
| `sub_category` | string | no | Optional sub-type (examples: coral `SPS`/`LPS`/`soft`; invertebrate `shrimp`/`snail`/`crab`) |
| `tank_zone` | string | no | Optional placement zone: `top`, `mid`, `bottom`, `rock`, `sand` |
| `origin` | string | no | Optional origin: `wild`, `captive`, `frag` |
| `date_added` | string | yes | Date-only (`YYYY-MM-DD`) |
| `date_removed` | string | no | Date-only (`YYYY-MM-DD`) |
| `status` | string | yes | One of: `active`, `removed`, `dead` |
| `notes` | string | no | Free text |

**Invariants**

- There MUST be only **one** `LIVESTOCK` sheet per tank (no separate tabs for fish/corals/invertebrates/plants).
- `category` is used for filtering and UI grouping only (it does not change the storage model).
- If `status` is `active`, `date_removed` SHOULD be blank.
- If `status` is `removed` or `dead`, `date_removed` SHOULD be set.

**Future-proofing (non-breaking)**

- Future optional fields MAY be added as additional columns **after** `notes` without requiring migrations.
- Examples: `growth_rate`, `light_requirement`, `flow_requirement`.

**Rationale: why livestock is unified**

- A single sheet avoids duplicated logic and keeps the inventory consistent (one lifecycle, one photo model, one events model).
- Categories remain a **filter** only — the storage model stays stable even as new livestock types are added.

---

### SHEET: `PHOTOS`

**Purpose**: store metadata for photos saved in Google Drive.

**Drive folders**

- Tank photos: `Tank_<tank_id>_<tank_name>/photos/tank/`
- Livestock photos (all categories): `Tank_<tank_id>_<tank_name>/photos/livestock/`

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Unique photo id (client-generated) |
| `date` | string | yes | ISO timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `related_type` | string | yes | One of: `tank`, `livestock` |
| `related_id` | string | no | Required when `related_type = livestock` (must match `LIVESTOCK.livestock_id`) |
| `drive_file_id` | string | yes | Google Drive file id of the uploaded photo |
| `drive_url` | string | yes | Shareable/view URL stored for convenience |
| `note` | string | no | Optional caption / notes |

**Invariants**

- If `related_type = tank`, `related_id` MUST be blank.
- If `related_type = livestock`, `related_id` MUST be present and valid.

---

### SHEET: `EQUIPMENT`

**Purpose**: track equipment used in the tank.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Unique equipment id (client-generated) |
| `type` | string | yes | Example: `light`, `pump`, `filter`, `skimmer`, `heater`, `ato` |
| `brand_model` | string | yes | Brand + model |
| `installation_date` | string | no | Date-only (`YYYY-MM-DD`) |
| `maintenance_interval` | string | no | Human-readable interval (example: `30d`, `12w`, `6m`) |
| `notes` | string | no | Free text |

---

### SHEET: `PARAMETER_RANGES`

**Purpose**: define parameter ranges (bands) used for alerts/highlights and reference values, and define the list of allowed test parameters + units.

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `parameter` | string | yes | Defines the allowed values for `WATER_TESTS.parameter` (same tank) |
| `min_value` | number | no | Minimum acceptable value (blank = no minimum) |
| `max_value` | number | no | Maximum acceptable value (blank = no maximum) |
| `unit` | string | yes | Unit label |
| `status` | string | yes | One of: `optimal`, `acceptable`, `critical` |
| `color` | string | no | Optional UI color for this parameter (recommended: hex like `#3b82f6`). Should be consistent across statuses for the same `parameter`. |

**Invariants**

- At least one of `min_value` or `max_value` MUST be set.
- `status` MUST be one of: `optimal`, `acceptable`, `critical`.
- Multiple rows per parameter are allowed (example: one `optimal` row and one `acceptable` row).
- The `unit` SHOULD be consistent across statuses for the same `parameter` (TankLog uses it as the source of truth when writing and displaying units).

**Notes**

- `PARAMETER_RANGES` is stored **per tank** (inside the tank’s spreadsheet), so ranges are evaluated in the context of the tank’s `TANK_INFO.type`.

#### Parameter ranges initialization

TankLog **auto-initializes** `PARAMETER_RANGES` when creating a new tank (Drive folder + `tank_data.xlsx`):

- The sheet is created automatically as part of the tank spreadsheet setup.
- The app pre-populates the sheet with a **default dataset** based on `TANK_INFO.type`:
  - `freshwater`
  - `planted`
  - `marine`
  - `reef`
- This initialization happens **only once**, at tank creation time.
- TankLog **never overwrites** the user’s ranges automatically after creation (users may edit manually).

---

## Rationale

- One file per tank simplifies permissions, backups, and portability.
- Measurement-based `WATER_TESTS` supports partial testing and clean charts.
- Drive folders mirror real-world aquarium organization.
- User-chosen folder location respects user ownership and privacy.
- Automatic folder creation improves onboarding UX.

