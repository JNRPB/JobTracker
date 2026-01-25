# 🏗️ JNR Job Tracker - React

[![React](https://img.shields.io/badge/React-18.2.0-blue?logo=react&logoColor=white)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

A **React-based front-end** for **JNR Plastering and Building**.  
Manage jobs, track costs, and plan phases in a modular, editable interface.

---

## 🚀 Features

- **Create Jobs** – Add new jobs with name, address, customer, notes, and status.  
- **Job Overview** – Inline editable job details, just click and type!  
- **Tabbed Job Card** – Switch between:
  - Job Overview
  - Predicted Phase Cost
  - Cost Ledger  
- **Editable Fields** – Update job name, address, and notes in-place  
- **Future-proof Design** – Easily add new tabs/components without breaking the app  

---

## 🗂️ Folder Structure

```text
src/
├─ components/
│  ├─ Sidebar.jsx
│  ├─ Main.jsx
│  ├─ JobCard.jsx
│  └─ JobCardTabs/
│     ├─ JobOverview.jsx
│     ├─ PredictedPhaseCost.jsx
│     └─ CostLedger.jsx
├─ App.jsx
└─ index.jsx
