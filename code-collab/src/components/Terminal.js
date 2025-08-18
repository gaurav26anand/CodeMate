import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import Button from 'react-bootstrap/esm/Button';
import axios from 'axios';

const TerminalComponent = ({ socketRef, roomId, onTerminalOutput, editorFiles, activeFileId }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const [isTerminalActive, setIsTerminalActive] = useState(true);
    // Keep latest editor state in refs to avoid stale closures inside xterm handlers
    const filesRef = useRef(editorFiles);
    const activeFileIdRef = useRef(activeFileId);

    useEffect(() => { filesRef.current = editorFiles; }, [editorFiles]);
    useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

    useEffect(() => {
        if (!terminalRef.current) return;

        const xterm = new Terminal({
            cursorBlink: true,
            convertEol: true,
            scrollback: 5000,
            theme: {
                background: '#1e1e1e',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selection: '#264f78',
                black: '#000000',
                red: '#e06c75',
                green: '#98c379',
                yellow: '#d19a66',
                blue: '#61afef',
                magenta: '#c678dd',
                cyan: '#56b6c2',
                white: '#ffffff',
                brightBlack: '#5c6370',
                brightRed: '#e06c75',
                brightGreen: '#98c379',
                brightYellow: '#d19a66',
                brightBlue: '#61afef',
                brightMagenta: '#c678dd',
                brightCyan: '#56b6c2',
                brightWhite: '#ffffff'
            },
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            rows: 28,
            cols: 120
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);

        xterm.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        xterm.writeln('Welcome to Code-Collab Terminal!');
        xterm.writeln('Type "help" for available commands.');
        xterm.writeln('');

        let currentLine = '';
        let historyIndex = -1;
        let commandHistory = [];

        xterm.onData((data) => {
            const code = data.charCodeAt(0);
            
            if (code === 13) {
                if (currentLine.trim()) {
                    commandHistory.push(currentLine);
                    historyIndex = commandHistory.length;
                    executeCommand(currentLine.trim());
                }
                xterm.writeln('');
                currentLine = '';
                xterm.write('$ ');
            } else if (code === 127) {
                if (currentLine.length > 0) {
                    currentLine = currentLine.slice(0, -1);
                    xterm.write('\b \b');
                }
            } else if (code === 27) {
                if (data.length > 2 && data.charCodeAt(1) === 91) {
                    const keyCode = data.charCodeAt(2);
                    if (keyCode === 65) {
                        if (historyIndex > 0) {
                            historyIndex--;
                            if (commandHistory[historyIndex]) {
                                xterm.write('\r$ ' + ' '.repeat(currentLine.length) + '\r$ ');
                                currentLine = commandHistory[historyIndex];
                                xterm.write(currentLine);
                            }
                        }
                    } else if (keyCode === 66) {
                        if (historyIndex < commandHistory.length - 1) {
                            historyIndex++;
                            if (commandHistory[historyIndex]) {
                                xterm.write('\r$ ' + ' '.repeat(currentLine.length) + '\r$ ');
                                currentLine = commandHistory[historyIndex];
                                xterm.write(currentLine);
                            }
                        } else {
                            historyIndex = commandHistory.length;
                            xterm.write('\r$ ' + ' '.repeat(currentLine.length) + '\r$ ');
                            currentLine = '';
                        }
                    }
                }
            } else if (code >= 32) {
                currentLine += data;
                xterm.write(data);
            }
        });

        xterm.write('$ ');

        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (xtermRef.current) {
                xtermRef.current.dispose();
            }
        };
    }, []);

    useEffect(() => {
        // Refit after expand/collapse to fill width and height
        const timer = setTimeout(() => fitAddonRef.current?.fit(), 320);
        return () => clearTimeout(timer);
    }, [isTerminalActive]);

    const getActiveFile = () => {
        const files = filesRef.current;
        const id = activeFileIdRef.current;
        if (!files || !id) return null;
        return files[id] || null;
    };

    const executeCommand = async (command) => {
        const xterm = xtermRef.current;
        if (!xterm) return;

        const args = command.split(' ').filter(Boolean);
        const cmd = (args[0] || '').toLowerCase();

        try {
            switch (cmd) {
                case 'help':
                    xterm.writeln('Available commands:');
                    xterm.writeln('  help                    - Show this help message');
                    xterm.writeln('  clear                   - Clear terminal');
                    xterm.writeln('  ls                      - List files in workspace');
                    xterm.writeln('  cat <filename>          - Display file contents');
                    xterm.writeln('  run [filename]          - Run a file (defaults to active file)');
                    xterm.writeln('  node [filename]         - Run JS file (defaults to active .js)');
                    xterm.writeln('  python [filename]       - Run Python file (defaults to active .py)');
                    xterm.writeln('  gcc <filename>          - Compile C file');
                    xterm.writeln('  g++ <filename>          - Compile C++ file');
                    xterm.writeln('  javac <filename>        - Compile Java file');
                    xterm.writeln('  java <classname>        - Run Java class');
                    xterm.writeln('  pwd                     - Show current directory');
                    xterm.writeln('  date                    - Show current date/time');
                    xterm.writeln('');
                    break;

                case 'clear':
                    xterm.clear();
                    xterm.writeln('Welcome to Code-Collab Terminal!');
                    xterm.writeln('Type "help" for available commands.');
                    xterm.writeln('');
                    break;

                case 'ls': {
                    const files = filesRef.current || {};
                    const currentActiveId = activeFileIdRef.current;
                    if (files && Object.keys(files).length > 0) {
                        xterm.writeln('Files in workspace:');
                        Object.values(files).forEach(file => {
                            const activeIndicator = file.id === currentActiveId ? ' *' : '';
                            xterm.writeln(`  ${file.name}${activeIndicator}`);
                        });
                    } else {
                        xterm.writeln('No files in workspace');
                    }
                    xterm.writeln('');
                    break;
                }

                case 'cat': {
                    if (args.length < 2) {
                        xterm.writeln('Usage: cat <filename>');
                        break;
                    }
                    const fileName = args[1];
                    const file = Object.values(filesRef.current || {}).find(f => f.name === fileName);
                    if (file) {
                        xterm.writeln(`=== ${file.name} ===`);
                        xterm.writeln(file.content);
                        xterm.writeln('=== End of file ===');
                    } else {
                        xterm.writeln(`File not found: ${fileName}`);
                    }
                    xterm.writeln('');
                    break;
                }

                case 'run': {
                    let runFile = null;
                    if (args.length >= 2) {
                        const runFileName = args[1];
                        runFile = Object.values(filesRef.current || {}).find(f => f.name === runFileName) || null;
                        if (!runFile) xterm.writeln(`File not found: ${runFileName}`);
                    } else {
                        runFile = getActiveFile();
                        if (!runFile) xterm.writeln('No active file to run');
                    }
                    if (runFile) await runFileInBackend(runFile, xterm);
                    xterm.writeln('');
                    break;
                }

                case 'node': {
                    let target = null;
                    if (args.length >= 2) {
                        const name = args[1];
                        target = Object.values(filesRef.current || {}).find(f => f.name === name);
                    } else {
                        target = getActiveFile();
                    }
                    if (target && target.extension === 'js') {
                        await runFileInBackend(target, xterm);
                    } else {
                        xterm.writeln('Usage: node [filename].js (active .js will be used if omitted)');
                    }
                    xterm.writeln('');
                    break;
                }

                case 'python': {
                    let target = null;
                    if (args.length >= 2) {
                        const name = args[1];
                        target = Object.values(filesRef.current || {}).find(f => f.name === name);
                    } else {
                        target = getActiveFile();
                    }
                    if (target && target.extension === 'py') {
                        await runFileInBackend(target, xterm);
                    } else {
                        xterm.writeln('Usage: python [filename].py (active .py will be used if omitted)');
                    }
                    xterm.writeln('');
                    break;
                }

                case 'gcc': {
                    if (args.length < 2) { xterm.writeln('Usage: gcc <filename.c>'); break; }
                    const cFileName = args[1];
                    const cFile = Object.values(filesRef.current || {}).find(f => f.name === cFileName);
                    if (cFile && cFile.extension === 'c') {
                        await runFileInBackend(cFile, xterm);
                    } else {
                        xterm.writeln(`Invalid file or not a C file: ${cFileName}`);
                    }
                    xterm.writeln('');
                    break;
                }

                case 'g++': {
                    if (args.length < 2) { xterm.writeln('Usage: g++ <filename.cpp>'); break; }
                    const cppFileName = args[1];
                    const cppFile = Object.values(filesRef.current || {}).find(f => f.name === cppFileName);
                    if (cppFile && cppFile.extension === 'cpp') {
                        await runFileInBackend(cppFile, xterm);
                    } else {
                        xterm.writeln(`Invalid file or not a C++ file: ${cppFileName}`);
                    }
                    xterm.writeln('');
                    break;
                }

                case 'javac': {
                    if (args.length < 2) { xterm.writeln('Usage: javac <filename.java>'); break; }
                    const javaFileName = args[1];
                    const javaFile = Object.values(filesRef.current || {}).find(f => f.name === javaFileName);
                    if (javaFile && javaFile.extension === 'java') {
                        await runFileInBackend(javaFile, xterm);
                    } else {
                        xterm.writeln(`Invalid file or not a Java file: ${javaFileName}`);
                    }
                    xterm.writeln('');
                    break;
                }

                case 'java': {
                    if (args.length < 2) { xterm.writeln('Usage: java <classname>'); break; }
                    xterm.writeln(`Running Java class: ${args[1]}`);
                    xterm.writeln('(Java execution requires compiled .class files)');
                    xterm.writeln('');
                    break;
                }

                case 'pwd':
                    xterm.writeln('/workspace/code-collab');
                    break;

                case 'date':
                    xterm.writeln(new Date().toString());
                    break;

                default:
                    if (cmd) xterm.writeln(`Command not found: ${cmd}. Type "help" for available commands.`);
                    break;
            }
        } catch (error) {
            xterm.writeln(`Error: ${error.message}`);
        }
    };

    const runFileInBackend = async (file, xterm) => {
        try {
            xterm.writeln(`Running ${file.name}...`);
            const response = await axios.post(`http://localhost:5000/${file.runtime}`, { runcode: file.content });
            if (response.data === 'SyntaxError') {
                xterm.writeln('❌ Syntax Error in file');
            } else {
                xterm.writeln('✅ Execution successful:');
                xterm.writeln(String(response.data));
            }
        } catch (error) {
            xterm.writeln(`❌ Execution failed: ${error.message}`);
        }
    };

    const toggleTerminal = () => {
        setIsTerminalActive(!isTerminalActive);
    };

    const clearTerminal = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.writeln('Welcome to Code-Collab Terminal!');
            xtermRef.current.writeln('Type "help" for available commands.');
            xtermRef.current.writeln('');
            xtermRef.current.write('$ ');
        }
    };

    return (
        <div className="terminal-container">
            <div className="terminal-header">
                <span>Terminal</span>
                <div className="terminal-controls">
                    <Button 
                        size="sm" 
                        variant="outline-secondary" 
                        onClick={clearTerminal}
                        style={{ marginRight: '8px' }}
                    >
                        Clear
                    </Button>
                    <Button 
                        size="sm" 
                        variant={isTerminalActive ? "success" : "secondary"}
                        onClick={toggleTerminal}
                    >
                        {isTerminalActive ? 'Collapse' : 'Expand'}
                    </Button>
                </div>
            </div>
            <div 
                ref={terminalRef} 
                className="terminal-body"
                style={{ 
                    height: isTerminalActive ? '100%' : '64px',
                    transition: 'height 0.3s ease',
                    overflow: 'auto'
                }}
            />
        </div>
    );
};

export default TerminalComponent;
