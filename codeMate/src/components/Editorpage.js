import React, { useEffect } from 'react';
import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import logo from '../images/output-onlinepngtools.png';
import Client from './Client';
import CodeEditor from './Editor';
import TerminalComponent from './Terminal';
import { useRef } from 'react';
import { initSocket } from '../socket.js';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import { useNavigate, Navigate, useParams } from 'react-router-dom';
import Chat from './Chat';

const Editorpage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();

  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClients] = useState([]);
  const [socketReady, setSocketReady] = useState(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
  const [editorState, setEditorState] = useState({ files: {}, activeFileId: null });

  function handleErrors(e) {
    console.log('socket error', e);
    toast.errror('Socket Connection failed , try again later.');
    reactNavigator('/');
  }

  useEffect(() => {

    const init = async () => {

      //Connection with Socket io
      socketRef.current = await initSocket();

      socketRef.current.on('connect_error', (err) => handleErrors(err));
      socketRef.current.on('connect_failed', (err) => handleErrors(err));

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });
      setSocketReady(true);
      console.log(clients);

      //For joining
      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        if (username !== location.state?.username) {
          toast.success(`${username} joined the room.`);
          console.log(`${username} joined`);
        }
        setClients(clients);
        // Send full editor state (multi-file) to the newly joined client
        // Only non-joining clients should perform this sync
        if (socketId !== socketRef.current.id) {
          const currentState = codeRef.current;
          if (currentState && typeof currentState === 'object') {
            socketRef.current.emit(ACTIONS.SYNC_CODE, {
              roomId,
              ...currentState, // { files, activeFileId }
              socketId,
            });
          }
        }
      }
      );

      //For disconnection
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter(client => client.socketId !== socketId)
        })
      })

    }
    init();
    return () => {
      socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
    };

  }, [])

  if (!location.state) {
    return <Navigate to="/" />
  }
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room Id has been copied to clipboard')
    } catch (err) {
      toast.error('Could not copy Room Id');
      console.log(err);
    }
  }
  const leaveRoom = () => {
    reactNavigator('/')
  }

  const toggleLeftSidebar = () => {
    setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed);
  };

  const toggleRightSidebar = () => {
    setIsRightSidebarCollapsed(!isRightSidebarCollapsed);
  };

  return (
    <div className="minWrap">
      {/* Left Sidebar */}
      <div 
        className="aside" 
        style={{ 
          width: isLeftSidebarCollapsed ? '60px' : '250px',
          transition: 'width 0.3s ease',
          overflow: 'hidden'
        }}
      >
        <div className="asideInner" style={{ opacity: isLeftSidebarCollapsed ? 0 : 1, transition: 'opacity 0.3s ease' }}>
          <div className="logo">
            <img className='logoImage' style={{ height: '40px', width: '40px' }} src={logo} alt="logo" />
            <h3 style={{ 
              color: 'rgb(231 11 56 / 78%)', 
              paddingTop: '8px', 
              paddingLeft: '10px', 
              fontWeight: '800',
              display: isLeftSidebarCollapsed ? 'none' : 'block'
            }}>CodeMate</h3>
          </div>
          <h5 style={{ 
            paddingTop: '1.5rem', 
            paddingBottom: '0.8rem',
            display: isLeftSidebarCollapsed ? 'none' : 'block'
          }}>Connected</h5>
          <div className='clientsList' style={{ display: isLeftSidebarCollapsed ? 'none' : 'block' }}>
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>
        
        {/* Toggle Button for Left Sidebar */}
        <Button 
          className='btn-toggle-sidebar' 
          style={{ 
            backgroundColor: '#4d67c3', 
            border: 'none', 
            outline: 'none',
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '30px',
            height: '30px',
            padding: '0',
            fontSize: '12px',
            borderRadius: '50%'
          }} 
          onClick={toggleLeftSidebar}
        >
          {isLeftSidebarCollapsed ? '→' : '←'}
        </Button>

        <Button 
          className='btn-copy-btn' 
          style={{ 
            backgroundColor: '#4d67c3', 
            border: 'none', 
            outline: 'none',
            display: isLeftSidebarCollapsed ? 'none' : 'block'
          }} 
          onClick={copyRoomId}
        >
          COPY ROOM ID
        </Button>
        <Button 
          className='btn-leave-btn' 
          style={{ 
            backgroundColor: 'rgb(231 11 56 / 78%)', 
            border: 'none',
            display: isLeftSidebarCollapsed ? 'none' : 'block'
          }} 
          onClick={leaveRoom}
        >
          LEAVE
        </Button>
      </div>

      {/* Main Editor Area */}
      <div className="editorWrap">
        <div className='middleTab'>
          {socketReady && (
            <>
              <div className="editor-section">
                <CodeEditor 
                  socketRef={socketRef} 
                  roomId={roomId} 
                  onCodeChange={(state) => { 
                    codeRef.current = state; 
                    setEditorState(state);
                  }} 
                />
              </div>
              <div className="terminal-section">
                <TerminalComponent 
                  socketRef={socketRef} 
                  roomId={roomId} 
                  editorFiles={editorState.files}
                  activeFileId={editorState.activeFileId}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar - Chat */}
      <div 
        className='rightTab' 
        style={{ 
          width: isRightSidebarCollapsed ? '60px' : '300px',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Toggle Button for Right Sidebar */}
        <Button 
          className='btn-toggle-chat' 
          style={{ 
            backgroundColor: '#4d67c3', 
            border: 'none', 
            outline: 'none',
            position: 'absolute',
            top: '10px',
            left: '10px',
            width: '30px',
            height: '30px',
            padding: '0',
            fontSize: '12px',
            borderRadius: '50%',
            zIndex: 10
          }} 
          onClick={toggleRightSidebar}
        >
          {isRightSidebarCollapsed ? '←' : '→'}
        </Button>

        <div style={{ 
          opacity: isRightSidebarCollapsed ? 0 : 1, 
          transition: 'opacity 0.3s ease',
          marginTop: '40px'
        }}>
          <Chat />
        </div>
      </div>
    </div>
  )
}

export default Editorpage;
