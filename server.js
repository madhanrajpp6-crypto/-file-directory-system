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
        children: [],
        modifiedAt: new Date().toISOString()
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
        type: "file",
        content: "",
        size: 0,
        modifiedAt: new Date().toISOString()
    });

    res.send("File created");
});

// API: Download File
app.get("/api/download", (req, res) => {
    let pathQuery = req.query.path;
    let name = req.query.name;
    let pathArray = [];
    if (pathQuery) {
        try {
            pathArray = JSON.parse(pathQuery);
        } catch (e) {
            return res.status(400).send("Invalid path format");
        }
    }
    
    let parent = findFolder(pathArray);
    if (!parent) return res.status(404).send("Path not found");
    
    let file = parent.children.find(c => c.name === name && c.type === "file");
    if (!file) return res.status(404).send("File not found");
    
    res.setHeader('Content-disposition', 'attachment; filename=' + name);
    res.setHeader('Content-type', 'text/plain');
    res.send(file.content || "");
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

// API: Get File Content
app.get("/api/file", (req, res) => {
    let pathQuery = req.query.path;
    let name = req.query.name;
    let pathArray = [];
    if (pathQuery) {
        try {
            pathArray = JSON.parse(pathQuery);
        } catch (e) {
            return res.status(400).send("Invalid path format");
        }
    }
    
    let parent = findFolder(pathArray);
    if (!parent) return res.status(404).send("Path not found");
    
    let file = parent.children.find(c => c.name === name && c.type === "file");
    if (!file) return res.status(404).send("File not found");
    
    res.json({ content: file.content || "" });
});

// API: Update File Content
app.post("/api/file", (req, res) => {
    let { path, name, content } = req.body;

    let parent = findFolder(path);
    if (!parent) return res.status(404).send("Path not found");
    
    let file = parent.children.find(c => c.name === name && c.type === "file");
    if (!file) return res.status(404).send("File not found");
    
    file.content = content || "";
    file.size = Buffer.byteLength(file.content, 'utf8');
    file.modifiedAt = new Date().toISOString();
    res.send("File updated");
});

// API: Rename Item
app.post("/rename", (req, res) => {
    let { path, oldName, newName } = req.body;

    if (!newName || newName.trim() === "") {
        return res.status(400).send("New name cannot be empty");
    }
    if (newName.includes("/") || newName.includes("\\")) {
        return res.status(400).send("Name cannot contain slashes");
    }

    let parent = findFolder(path);
    if (!parent) return res.status(404).send("Path not found");

    if (parent.children.some(c => c.name === newName.trim())) {
        return res.status(400).send("A file or folder with this name already exists");
    }

    let item = parent.children.find(c => c.name === oldName);
    if (!item) return res.status(404).send("Item not found");

    item.name = newName.trim();
    res.send("Item renamed");
});

// API: Get Structure (kept for backward compatibility or debug)
app.get("/tree", (req, res) => {
    res.json(fileSystem);
});
// API: Deep Search
app.get("/api/search", (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : "";
    if (!query) return res.json([]);
    let results = [];
    function searchTree(node, currentPath = []) {
        if (node.name.toLowerCase().includes(query) && node.name !== "root") {
            results.push({ name: node.name, type: node.type, path: currentPath });
        }
        if (node.children) {
            node.children.forEach(child => {
                searchTree(child, [...currentPath, node.name === "root" ? null : node.name].filter(p => p !== null));
            });
        }
    }
    searchTree(fileSystem);
    res.json(results);
});

app.listen(3000, () => {
    console.log("🚀 Premium Cloud Drive running on http://localhost:3000");
});
