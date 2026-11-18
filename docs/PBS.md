# Work breakdown (PBS)

Source: `PBS-Tym_3.xlsx` (team spreadsheet, the source of truth for task-level estimates and assignees). A PDF export of its latest state (18 Nov 2026) is stored in this repo as [`PBS-Tym_3.pdf`](PBS-Tym_3.pdf); if this file and the PDF disagree, the PDF/spreadsheet wins. Task types: **ANA** analysis, **IMP** implementation, **TST** testing, **MNG** management.

## Sprints

| Sprint | Semester weeks | Focus                                                                                                                                                         |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | 5-7            | Foundation and employee access: repo, DB schema, base BE/FE apps, auth, employee/vehicle registration, business model and wireframes                          |
| 2      | 7-10           | The 11 user stories (US 1-11): availability, parking history, active parking, reservations, vehicle registration, notifications, payment, spot administration |
| 3      | 10-12          | Occupancy analytics, final fixes, deployment, documentation, regression and release acceptance                                                                |

Each sprint also contains full-team meetings (planning, weekly coordination, review, retrospective), management tasks (progress tracking, spec-change approval, demo recording, minutes) and continuous verification (BE/FE tests, Bug Report). The course demo presentation is on 18 Nov 2026 (week 8). Sprint 3 planning is due by 6 Dec 2026 (week 10) with a presentation on 9 Dec (week 11); the project completes no later than 20 Dec 2026 (week 12), week 13 is excluded.

Total estimate in the spreadsheet: 677 h.

## Feature areas

| Area                       | Sprint | Scope                                                                                                                                                                                                      |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technical foundation       | 1      | Repository, DB schema, sample data, base backend and frontend, linting/build/test pipelines, API client                                                                                                    |
| Employee access            | 1, 2   | Authentication and employee/admin authorisation, registration, vehicle plate validation and EV flag, vehicle CRUD, admin access management; Sprint 2: parking history, vehicle registration, notifications |
| Parking availability       | 2      | Sprint 2 user stories: available spots, reservations (reserve, delete, view, edit), spot creation with audit log                                                                                           |
| Automatic gate access      | 2      | Start and end active parking                                                                                                                                                                               |
| Business model             | 1, 2   | Sprint 1 analysis deliverables; Sprint 2: payment for a parking session                                                                                                                                    |
| Occupancy analytics        | 3      | Hourly time-weighted occupancy, peak hour ranking, utilisation, date filters, admin-only endpoint and visualisation                                                                                        |
| Documentation and delivery | 3      | Deployment, backup/restore, API and setup docs, usage guide, acceptance evidence                                                                                                                           |

## Sprint 1 ownership

| Person             | Tasks                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Andrej Pavliščak   | Base frontend app, routing and layout; employee registration and validation screen                                                                                                |
| Daniel Artur Hüttl | Frontend lint/build/test pipeline; login, logout and restricted navigation                                                                                                        |
| Honza Heller       | Vehicle plate validation, uniqueness and EV flag; vehicle create/edit/remove endpoints                                                                                            |
| Honza Hubal        | Authentication and employee/admin authorisation; admin employee and access-management endpoints                                                                                   |
| Leo                | Actors and permissions, features and acceptance criteria, registration/approval process, entry/exit processes, capacity rules, charger states, EV discount rules; BE and FE tests |
| Ludmila            | Sample data; employee registration and access activation endpoints                                                                                                                |
| Matěj              | Repository setup, DB schema, base backend and environment configuration                                                                                                           |
| Oleg               | API client, loading and error states; vehicle list and edit form                                                                                                                  |
| Ray                | EV tariff and admin analytics use cases, employee and admin wireframes, business model review, Bug Report template                                                                |
| Šimon              | Data products (employee, vehicle, parking lot, visit, gate event, charger, tariff), data relationships, registration, gate and availability use cases, defect logging             |
| Vojta              | Sprint 1 backend defect fixes; authentication and employee API docs                                                                                                               |

## Sprint 2 user stories

Each story has four tasks: BE, FE, BE test, FE test (hours = estimate; status as of the 18 Nov 2026 export).

| US    | Story                                    | BE (h, who, status)          | FE (h, who, status)                | Tests (BE / FE) |
| ----- | ---------------------------------------- | ---------------------------- | ---------------------------------- | --------------- |
| US 1  | Display available parking spots          | 3, Vojta, in progress        | 3, Andrej Pavliščak, in progress   | Leo / Ray       |
| US 2  | History of parking records               | 3, Matěj, not started        | 3, Oleg, not started               | Ray / Ray       |
| US 3  | Start and end active parking             | 4, Honza Hubal, done         | 3, Daniel Artur Hüttl, not started | Leo / Šimon     |
| US 4  | Reserve a parking spot                   | 5, Honza Hubal, done         | 5, Oleg, in progress               | Leo / Šimon     |
| US 5  | Register vehicle                         | (Sprint 1 endpoints)         | 3, Andrej Pavliščak, in progress   | none / Ray      |
| US 6  | Deletion of reservation                  | 3, Ludmila, not started      | 2, Oleg, not started               | Leo / Ray       |
| US 7  | View active parking reservation          | 2, Honza Heller, not started | 2, Daniel Artur Hüttl, not started | Šimon / Ray     |
| US 8  | Notifications                            | 4, Ludmila, not started      | 3, Andrej Pavliščak, not started   | Leo / Ray       |
| US 9  | Pay for a parking session                | 5, Matěj, not started        | 3, Daniel Artur Hüttl, not started | Leo / Šimon     |
| US 10 | Create a new parking spot with audit log | 5, Honza Heller, in progress | 4, Andrej Pavliščak, in progress   | Leo / Šimon     |
| US 11 | Edit an upcoming reservation             | 4, Honza Hubal, done         | 3, Oleg, not started               | Šimon / Šimon   |

Sprint 2 also has weekly team meetings (weeks 8-10), full-project verification by all testers (basic user journey, parking journey, user/admin permissions, end-to-end login to payment and history, FE-BE integration), bug fixing (8 h, FE + BE developers) and retesting (5 h, all testers), plus review, retrospective and minutes.

## Sprint 3 tasks

Mostly unassigned ("Waiting"). Backend analytics (weeks 11-12): hourly time-weighted occupancy, peak/utilisation/busiest-hour ranking, date-range filters and admin-only endpoint, index and query performance, analytics docs. Frontend: admin occupancy trend and peak-hour visualisation, date filters and KPI display, empty/invalid/error states. Tests for BE and FE analytics, final BE and FE defect fixes, deployment (release environment, secrets, backup/restore/rollback, frontend), setup and usage documentation, business model update, full BE and FE regression with cross-browser checks, final test report, acceptance evidence, smoke tests, demo, review, retrospective and final submission. No new feature work is planned for week 12. Assign them in the spreadsheet and keep this file in sync.
