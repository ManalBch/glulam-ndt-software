# glulam-ndt-software
Created with CodeSandbox
# Glulam Beam NDT Analyzer

This repository contains a React-based web application for non-destructive testing (NDT) of glulam beams.  
The app analyzes time-of-flight (TOF) stress-wave measurements to:
- detect possible delamination zones along the beam length, and  
- localize delamination in the thickness direction (at specific glue-lines / layers).

--------------------------------------------------------------------------------------------------------------------------------------------------


# Live Application (Interactive)

The tool can be used directly in your browser without installation:

👉 **https://yjkqs3-3000.csb.app/**

This hosted version lets users perform the full workflow:
- select beam length,
- input TOF measurements,
- analyze delamination zones,
- run layer-wise tests,
- visualize results interactively.

------------------------------------------------------------------------------------------------------------------------------------------------

## Repository Structure

The main project files include:

- `src/`
  - `GlulamNDTApp.jsx` (main application logic and UI)
  - all React components, helper functions, and styles
- `public/`
  - HTML template and static assets
- `package.json`
  - React settings, dependencies, and scripts
- `README.md`
  - project description and instructions (this file)

> The core logic for TOF analysis, zone detection, delamination severity,  
> and layer-wise glue-line identification is located inside  
> **`src/GlulamNDTApp.jsx`**.

--------------------------------------------------------------------------------------------------------------------------------------------------------
