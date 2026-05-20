# Structra

Structra is a desktop utility for inspecting and editing JSON and JSONL datasets. It is built with a React frontend and a Rust/Tauri backend.

The tool provides a grid-based editor with standard keyboard navigation to help quickly review or modify dataset files locally.

## Features

- **Keyboard Navigation**: Use arrow keys to navigate the data grid. Press `Enter` to commit a cell edit and move to the next row.
- **Undo / Redo**: Cell text edits are tracked in a global history stack. Use `Ctrl+Z` to undo and `Ctrl+Y` to redo changes.
- **Schema Editing**: Add, rename, or delete columns dynamically.
- **Stable Formatting**: The backend parser preserves the exact column order of the original JSON file.
- **Exporting**: Save modifications directly to the loaded JSON file or export the dataset as JSONL.

## Development

This project uses Node.js and Rust. Ensure you have both installed before proceeding, along with the standard Tauri dependencies for your operating system.

### Running Locally

1. Clone the repository and navigate into the folder:
   ```bash
   git clone https://github.com/yourusername/structra.git
   cd structra
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run tauri dev
   ```

### Building Installers

To compile standalone executables for your platform (e.g., `.deb`, `.rpm`, or `.exe`):

```bash
npm run tauri build
```
The output bundles will be placed in the `src-tauri/target/release/bundle/` directory.

## Contributing

Contributions are welcome. If you find a bug or have a suggestion, feel free to open an issue or submit a pull request.

Some areas that currently need improvement:
- Implementing pagination or virtualization to handle very large datasets without UI lag.
- Adding advanced filtering and sorting mechanisms.
- Supporting CSV imports/exports.

When contributing code, please ensure your changes are tested locally using `npm run tauri dev`.
