/* Global variables */
let files = {};
let activeFile = 'sketch.pde';
let maximizedPanel = null;
let fileOrder = [];
let dropCounter = 0;
let currentFileToRename = null;
let currentFileToDelete = null;
let currentFileToDownload = null;
let editor; // CodeMirror instance

function init() {
  // Load from localStorage or use default sketch
  const saved = localStorage.getItem('webIDE_files');
  if (saved) {
    files = JSON.parse(saved);
  } else {
    files = {
      "sketch.pde": {
        name: "sketch.pde",
        content: `void setup() {
  size(400, 400);
}

void draw() {
  background(0);
  fill(255);
  ellipse(width/2, height/2, 50, 50);
}`
      }
    };
    saveFiles();
  }
  const order = localStorage.getItem('webIDE_fileOrder');
  fileOrder = order ? JSON.parse(order) : Object.keys(files);
  
  // Initialize CodeMirror
  editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
    lineNumbers: true,
    mode: "text/x-java",
    theme: "dracula",
    indentUnit: 2,
    tabSize: 2,
    autoIndent: true
  });
  editor.setSize("100%", "100%");
  editor.on('change', function() {
    if (activeFile in files) {
      files[activeFile].content = editor.getValue();
      saveFiles();
    }
  });
  
  updateTabs();
  loadFile(activeFile);
  updatePreview();
  
  // Set up a MutationObserver to auto-scroll consoleOutput when new nodes are added.
  const consoleOutput = document.getElementById('consoleOutput');
  const observer = new MutationObserver(() => {
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  });
  observer.observe(consoleOutput, { childList: true, subtree: true });
}

/* Save files and order */
function saveFiles() {
  localStorage.setItem('webIDE_files', JSON.stringify(files));
  localStorage.setItem('webIDE_fileOrder', JSON.stringify(fileOrder));
}

/* Update file tabs */
function updateTabs() {
  const tabsContainer = document.getElementById('tabs');
  tabsContainer.innerHTML = '';
  fileOrder.forEach(fileName => {
    if (files[fileName]) createTabElement(fileName);
  });
  for (const fileName in files) {
    if (!fileOrder.includes(fileName)) {
      fileOrder.push(fileName);
      createTabElement(fileName);
    }
  }
}

/* Create a tab element with dropdown menu */
function createTabElement(fileName) {
  const tabsContainer = document.getElementById('tabs');
  const tabContainer = document.createElement('div');
  tabContainer.className = 'tab-container';
  if (fileName === activeFile) tabContainer.classList.add('active');
  
  const tabFilename = document.createElement('span');
  tabFilename.className = 'tab-filename';
  tabFilename.textContent = fileName;
  tabFilename.addEventListener('click', function() {
    saveCurrentFile();
    activeFile = fileName;
    loadFile(activeFile);
    updateTabs();
  });
  tabContainer.appendChild(tabFilename);
  
  const menuBtn = document.createElement('button');
  menuBtn.className = 'tab-menu-btn';
  menuBtn.textContent = '⋮';
  menuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    const dropdown = tabContainer.querySelector('.dropdown-menu');
    dropdown.classList.toggle('show');
  });
  tabContainer.appendChild(menuBtn);
  
  const dropdownMenu = document.createElement('div');
  dropdownMenu.className = 'dropdown-menu';
  
  const deleteItem = document.createElement('div');
  deleteItem.className = 'dropdown-item';
  deleteItem.textContent = 'Delete';
  deleteItem.addEventListener('click', function(e) {
    e.stopPropagation();
    openDeleteModal(fileName);
    dropdownMenu.classList.remove('show');
  });
  dropdownMenu.appendChild(deleteItem);
  
  const downloadItem = document.createElement('div');
  downloadItem.className = 'dropdown-item';
  downloadItem.textContent = 'Download';
  downloadItem.addEventListener('click', function(e) {
    e.stopPropagation();
    openDownloadModal(fileName);
    dropdownMenu.classList.remove('show');
  });
  dropdownMenu.appendChild(downloadItem);
  
  const renameItem = document.createElement('div');
  renameItem.className = 'dropdown-item';
  renameItem.textContent = 'Rename';
  renameItem.addEventListener('click', function(e) {
    e.stopPropagation();
    openRenameModal(fileName);
    dropdownMenu.classList.remove('show');
  });
  dropdownMenu.appendChild(renameItem);
  
  tabContainer.appendChild(dropdownMenu);
  
  tabContainer.setAttribute('draggable', true);
  tabContainer.addEventListener('dragstart', function(e) {
    e.dataTransfer.setData('text/plain', fileName);
    tabContainer.classList.add('dragging');
  });
  tabContainer.addEventListener('dragend', function() {
    tabContainer.classList.remove('dragging');
  });
  tabContainer.addEventListener('dragover', function(e) {
    e.preventDefault();
    tabContainer.classList.add('dragover');
  });
  tabContainer.addEventListener('dragleave', function() {
    tabContainer.classList.remove('dragover');
  });
  tabContainer.addEventListener('drop', function(e) {
    e.preventDefault();
    tabContainer.classList.remove('dragover');
    const draggedFile = e.dataTransfer.getData('text/plain');
    if (draggedFile && draggedFile !== fileName) {
      const draggedIndex = fileOrder.indexOf(draggedFile);
      const targetIndex = fileOrder.indexOf(fileName);
      if (draggedIndex > -1 && targetIndex > -1) {
        fileOrder.splice(draggedIndex, 1);
        fileOrder.splice(targetIndex, 0, draggedFile);
        updateTabs();
        saveFiles();
      }
    }
  });
  
  tabsContainer.appendChild(tabContainer);
}

/* Hide open dropdown menus on click outside */
document.addEventListener('click', function() {
  document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
});

/* Load file into CodeMirror */
function loadFile(fileName) {
  const file = files[fileName];
  editor.setValue(file.content);
  editor.setOption("mode", "text/x-java");
}

/* Save current file */
function saveCurrentFile() {
  if (activeFile in files) {
    files[activeFile].content = editor.getValue();
    saveFiles();
  }
}

/* Update the Processing preview iframe */
function updatePreview() {
  saveCurrentFile();
  const pdeContent = files[activeFile].content;
  const blob = new Blob([pdeContent], { type: "text/plain" });
  const blobURL = URL.createObjectURL(blob);
  
  // Build preview HTML. Do not hide external console elements.
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Processing Preview</title>
  <style>
    html, body { 
      margin: 0; 
      padding: 0; 
      height: 100%; 
      overflow: hidden; 
      background: #fff;
    }
    /* Force external console elements visible */
    .pjsconsole, .console, .dragger { display: block !important; }
    /* Center canvas horizontally (top remains at top) */
    canvas { display: block; margin: 0 auto; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/processing.js/1.6.6/processing.min.js"></script>
</head>
<body>
  <canvas data-processing-sources="${blobURL}"></canvas>
</body>
</html>`;
  
  const iframe = document.getElementById('previewFrame');
  iframe.contentDocument.open();
  iframe.contentDocument.write(htmlContent);
  iframe.contentDocument.close();
  
  // Poll for the external console element in the iframe and embed it when found.
  pollForExternalConsole(iframe, 20);
}

/* Poll for external Processing console and embed it */
function pollForExternalConsole(iframe, attempts) {
  if (attempts <= 0) return;
  const extConsole = iframe.contentDocument.querySelector('.pjsconsole');
  if (extConsole) {
    const parentConsole = document.getElementById('consoleOutput');
    parentConsole.innerHTML = "";
    extConsole.style.display = 'block';
    parentConsole.appendChild(extConsole);
  } else {
    setTimeout(() => pollForExternalConsole(iframe, attempts - 1), 200);
  }
}

/* Modal functions */
function openCreateFileModal() {
  const modal = document.getElementById('createFileModal');
  document.getElementById('createFileInput').value = "";
  modal.classList.remove('hidden');
  document.getElementById('createFileInput').focus();
}
function openDownloadModal(fileName) {
  currentFileToDownload = fileName;
  const modal = document.getElementById('downloadModal');
  document.getElementById('downloadInput').value = fileName;
  modal.classList.remove('hidden');
  document.getElementById('downloadInput').focus();
}
function openZipModal() {
  const modal = document.getElementById('zipModal');
  const input = document.getElementById('zipInput');
  if (!input.value) input.value = "project.zip";
  modal.classList.remove('hidden');
  input.focus();
}
function openRenameModal(fileName) {
  currentFileToRename = fileName;
  const modal = document.getElementById('renameModal');
  document.getElementById('renameInput').value = fileName;
  modal.classList.remove('hidden');
  document.getElementById('renameInput').focus();
}
function openDeleteModal(fileName) {
  currentFileToDelete = fileName;
  const modal = document.getElementById('deleteModal');
  document.getElementById('deleteModalMessage').textContent = `Are you sure you want to delete "${fileName}"?`;
  modal.classList.remove('hidden');
}

/* File export functions */
function exportFile(fileName, downloadName) {
  const file = files[fileName];
  const blob = new Blob([file.content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = downloadName || fileName;
  a.click();
}
function exportZipFile(zipName) {
  const zip = new JSZip();
  for (const fileName in files) {
    zip.file(fileName, files[fileName].content);
  }
  zip.generateAsync({ type: "blob" }).then(function(content) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = zipName;
    a.click();
  });
}

/* Event Listeners */
document.getElementById('newFileBtn').addEventListener('click', openCreateFileModal);
document.getElementById('importBtn').addEventListener('click', function() {
  document.getElementById('importInput').click();
});
document.getElementById('importInput').addEventListener('change', function(event) {
  const fileList = event.target.files;
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const reader = new FileReader();
    reader.onload = function(e) {
      files[file.name] = { name: file.name, content: e.target.result };
      if (!fileOrder.includes(file.name)) fileOrder.push(file.name);
      updateTabs();
      saveFiles();
      if (file.name === activeFile) updatePreview();
    };
    reader.readAsText(file);
  }
});
document.getElementById('exportAllBtn').addEventListener('click', openZipModal);

/* Create File Modal */
document.getElementById('createFileCancelBtn').addEventListener('click', function() {
  document.getElementById('createFileModal').classList.add('hidden');
});
document.getElementById('createFileConfirmBtn').addEventListener('click', function() {
  let fileName = document.getElementById('createFileInput').value.trim();
  if (!fileName) {
    alert("File name cannot be empty.");
    return;
  }
  if (!fileName.toLowerCase().endsWith('.pde')) fileName += '.pde';
  if (files[fileName]) {
    alert("File already exists.");
    return;
  }
  files[fileName] = { name: fileName, content: "" };
  fileOrder.push(fileName);
  activeFile = fileName;
  updateTabs();
  loadFile(activeFile);
  saveFiles();
  document.getElementById('createFileModal').classList.add('hidden');
});

/* Download Modal */
document.getElementById('downloadCancelBtn').addEventListener('click', function() {
  document.getElementById('downloadModal').classList.add('hidden');
});
document.getElementById('downloadConfirmBtn').addEventListener('click', function() {
  const newName = document.getElementById('downloadInput').value.trim();
  if (!newName) {
    alert("File name cannot be empty.");
    return;
  }
  exportFile(currentFileToDownload, newName);
  document.getElementById('downloadModal').classList.add('hidden');
});

/* Export ZIP Modal */
document.getElementById('zipCancelBtn').addEventListener('click', function() {
  document.getElementById('zipModal').classList.add('hidden');
});
document.getElementById('zipConfirmBtn').addEventListener('click', function() {
  let zipName = document.getElementById('zipInput').value.trim();
  if (!zipName) {
    alert("ZIP file name cannot be empty.");
    return;
  }
  if (!zipName.toLowerCase().endsWith('.zip')) zipName += '.zip';
  exportZipFile(zipName);
  document.getElementById('zipModal').classList.add('hidden');
});

/* Rename Modal */
document.getElementById('renameCancelBtn').addEventListener('click', function() {
  document.getElementById('renameModal').classList.add('hidden');
});
document.getElementById('renameSaveBtn').addEventListener('click', function() {
  let newName = document.getElementById('renameInput').value.trim();
  if (!newName) {
    alert("File name cannot be empty.");
    return;
  }
  if (!newName.toLowerCase().endsWith('.pde')) newName += '.pde';
  if (newName === currentFileToRename) {
    document.getElementById('renameModal').classList.add('hidden');
    return;
  }
  if (files[newName]) {
    alert("A file with that name already exists.");
    return;
  }
  files[newName] = { name: newName, content: files[currentFileToRename].content };
  delete files[currentFileToRename];
  const index = fileOrder.indexOf(currentFileToRename);
  if (index > -1) fileOrder[index] = newName;
  if (activeFile === currentFileToRename) activeFile = newName;
  updateTabs();
  loadFile(activeFile);
  saveFiles();
  updatePreview();
  document.getElementById('renameModal').classList.add('hidden');
});

/* Delete Modal */
document.getElementById('deleteCancelBtn').addEventListener('click', function() {
  document.getElementById('deleteModal').classList.add('hidden');
});
document.getElementById('deleteConfirmBtn').addEventListener('click', function() {
  if (currentFileToDelete) {
    delete files[currentFileToDelete];
    const index = fileOrder.indexOf(currentFileToDelete);
    if (index > -1) fileOrder.splice(index, 1);
    if (activeFile === currentFileToDelete) {
      const fileNames = Object.keys(files);
      activeFile = fileNames.length ? fileNames[0] : 'sketch.pde';
      if (!files[activeFile]) {
        files[activeFile] = { name: activeFile, content: '' };
        fileOrder.push(activeFile);
      }
      loadFile(activeFile);
    }
    updateTabs();
    saveFiles();
    updatePreview();
    document.getElementById('deleteModal').classList.add('hidden');
  }
});

/* Panel Maximization */
document.getElementById('maximizeLeftBtn').addEventListener('click', function() {
  toggleMaximize('left');
});
document.getElementById('maximizeRightBtn').addEventListener('click', function() {
  toggleMaximize('right');
});
function toggleMaximize(panel) {
  const editorPane = document.getElementById('editorPane');
  const previewPane = document.getElementById('previewPane');
  const maximizeLeftBtn = document.getElementById('maximizeLeftBtn');
  const maximizeRightBtn = document.getElementById('maximizeRightBtn');
  if (maximizedPanel === panel) {
    editorPane.style.flex = "1";
    previewPane.style.flex = "1";
    maximizedPanel = null;
    maximizeLeftBtn.textContent = "Maximize Editor";
    maximizeRightBtn.textContent = "Maximize Preview";
  } else {
    if (panel === 'left') {
      editorPane.style.flex = "1 1 100%";
      previewPane.style.flex = "0";
      maximizedPanel = panel;
      maximizeLeftBtn.textContent = "Minimize Editor";
      maximizeRightBtn.textContent = "Maximize Preview";
    } else if (panel === 'right') {
      previewPane.style.flex = "1 1 100%";
      editorPane.style.flex = "0";
      maximizedPanel = panel;
      maximizeRightBtn.textContent = "Minimize Preview";
      maximizeLeftBtn.textContent = "Maximize Editor";
    }
  }
}

/* Console Panel Toggle */
document.getElementById('toggleConsoleBtn').addEventListener('click', function() {
  const consolePanel = document.getElementById('consolePanel');
  const btn = document.getElementById('toggleConsoleBtn');
  if (consolePanel.classList.contains('hidden')) {
    consolePanel.classList.remove('hidden');
    btn.textContent = "Hide Console";
  } else {
    consolePanel.classList.add('hidden');
    btn.textContent = "Show Console";
  }
});
document.getElementById('clearConsoleBtn').addEventListener('click', function() {
  document.getElementById('consoleOutput').innerHTML = '';
});
document.getElementById('refreshPreviewBtn').addEventListener('click', updatePreview);

/* Drag-and-Drop File Import */
document.addEventListener('dragenter', function(e) {
  e.preventDefault();
  dropCounter++;
  const overlay = document.getElementById('dropOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('active');
});
document.addEventListener('dragover', function(e) {
  e.preventDefault();
});
document.addEventListener('dragleave', function() {
  dropCounter--;
  setTimeout(() => {
    if (dropCounter <= 0) {
      dropCounter = 0;
      const overlay = document.getElementById('dropOverlay');
      overlay.classList.remove('active');
      overlay.classList.add('hidden');
    }
  }, 50);
});
document.addEventListener('drop', function(e) {
  e.preventDefault();
  dropCounter = 0;
  const overlay = document.getElementById('dropOverlay');
  overlay.classList.remove('active');
  overlay.classList.add('hidden');
  const fileList = e.dataTransfer.files;
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const reader = new FileReader();
    reader.onload = function(e) {
      files[file.name] = { name: file.name, content: e.target.result };
      if (!fileOrder.includes(file.name)) fileOrder.push(file.name);
      updateTabs();
      saveFiles();
      if (file.name === activeFile) updatePreview();
    };
    reader.readAsText(file);
  }
});

/* Save current file before unload */
window.addEventListener('beforeunload', saveCurrentFile);
window.addEventListener('load', init);
