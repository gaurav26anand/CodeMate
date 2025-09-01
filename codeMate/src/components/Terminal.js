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
        xterm.write('$ ');

        const handleResize = () => {
            if (fitAddonRef.current) fitAddonRef.current.fit();
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (xtermRef.current) xtermRef.current.dispose();
        };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => fitAddonRef.current?.fit(), 320);
        return () => clearTimeout(timer);
    }, [isTerminalActive]);

    const getActiveFile = () => {
        const files = filesRef.current;
        const id = activeFileIdRef.current;
        if (!files || !id) return null;
        return files[id] || null;
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

    // 🔹 Run button click handler (supports any language)
    const handleRun = () => {
        const xterm = xtermRef.current;
        const activeFile = getActiveFile();
        if (!xterm) return;

        if (!activeFile) {
            xterm.writeln("⚠️ No active file selected to run.");
            return;
        }

        const ext = activeFile.extension;

        if (["js", "py", "c", "cpp", "java"].includes(ext)) {
            runFileInBackend(activeFile, xterm);
        } else {
            xterm.writeln(`⚠️ Running not supported for .${ext} files`);
        }
    };

    const toggleTerminal = () => setIsTerminalActive(!isTerminalActive);

    const clearTerminal = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.writeln('Welcome to CodeMate Terminal!');
            xtermRef.current.writeln('Type "help" for available commands.');
            xtermRef.current.writeln('');
            xtermRef.current.write('$ ');
        }
    };

    return (
        <div className="terminal-container">
            <div className="terminal-header flex items-center justify-between">
                <span>Terminal</span>
                <div className="terminal-controls">
                    {/* 🔹 Single Run button for all languages */}
                    <Button 
                        size="sm" 
                        variant="primary" 
                        onClick={handleRun}
                        style={{ marginRight: '8px' }}
                    >
                        ▶ Run
                    </Button>
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
