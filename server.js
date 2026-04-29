const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.json());
app.use(express.static('public')); // Serve frontend files

// In-memory file system (Tree)
let fileSystem = {
    name: "root",
    type: "folder",
    children: []
};

// Helper function
function findFolder(path) {
    if (!Array.isArray(path)) return null;
    let current = fileSystem;
    for (let folder of path) {
        current = current.children.find(
            c => c.name === folder && c.type === "folder"
        );
        if (!current) return null;
    }
    return current;
}

// API: Get Directory Contents
app.get("/api/ls", (req, res) => {
    let pathQuery = req.query.path;
    let pathArray = [];
    if (pathQuery) {
        try {
            pathArray = JSON.parse(pathQuery);
        } catch (e) {
            return res.status(400).send("Invalid path format");
        }
    }
    
    let target = findFolder(pathArray);
    if (!target) return res.status(404).send("Path not found");
    
    res.json({
        name: target.name,
        type: target.type,
        children: target.children
    });
});

// API: Create Folder
app.post("/mkdir", (req, res) => {
    let { path, name } = req.body;
    
    if (!name || name.trim() === "") {
        return res.status(400).send("Folder name cannot be empty");
    }
    if (name.includes("/") || name.includes("\\")) {
        return res.status(400).send("Name cannot contain slashes");
    }

    let parent = findFolder(path);
    if (!parent) return res.status(404).send("Path not found");

    if (parent.children.some(c => c.name === name.trim())) {
        return res.status(400).send("A file or folder with this name already exists");
    }

    parent.children.push({
        name: name.trim(),
        type: "folder",
        children: []
    });

    res.send("Folder created");
});

// API: Create File
app.post("/touch", (req, res) => {
    let { path, name } = req.body;

    if (!name || name.trim() === "") {
        return res.status(400).send("File name cannot be empty");
    }
    if (name.includes("/") || name.includes("\\")) {
        return res.status(400).send("Name cannot contain slashes");
    }

    let parent = findFolder(path);
    if (!parent) return res.status(404).send("Path not found");

    if (parent.children.some(c => c.name === name.trim())) {
        return res.status(400).send("A file or folder with this name already exists");
    }

    parent.children.push({
        name: name.trim(),
        type: "file"
    });

    res.send("File created");
});

// API: Delete Item
app.post("/delete", (req, res) => {
    let { path, name } = req.body;

    if (!name || name.trim() === "") {
        return res.status(400).send("Name cannot be empty");
    }

    let parent = findFolder(path);
    if (!parent) return res.status(404).send("Path not found");

    const index = parent.children.findIndex(c => c.name === name.trim());
    if (index === -1) {
        return res.status(404).send("Item not found");
    }

    parent.children.splice(index, 1);
    res.send("Item deleted");
});

// API: Get Structure (kept for backward compatibility or debug)
app.get("/tree", (req, res) => {
    res.json(fileSystem);
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});