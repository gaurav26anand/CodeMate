import React, { useEffect, useState, useRef } from 'react';
import { initSocket } from '../socket.js';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';

const Chat = () => {
	const chatRef = useRef();
	const scrollRef = useRef();
	const [chat, setChat] = useState([]);

	// Getting name from local storage
	const localData = JSON.parse(localStorage.getItem('name'));
	const [state, setState] = useState({ name: localData, message: "" });

	useEffect(() => {
		const init = async () => {
			chatRef.current = await initSocket();
			chatRef.current.on("message", ({ name, message }) => {
				setChat(prev => [...prev, { name, message }]);
			});
		};
		init();
		return () => chatRef.current.disconnect();
	}, []);

	// Auto-scroll to bottom when new msg comes
	useEffect(() => {
		scrollRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chat]);

	const onTextChange = (e) => {
		setState({ ...state, [e.target.name]: e.target.value });
	};

	const onMessageSubmit = (e) => {
		e.preventDefault();
		const { name, message } = state;
		if (!message.trim()) return;
		chatRef.current.emit("message", { name, message });
		setState({ name, message: "" });
	};

	// Render chat with bubble design
	const renderChat = () => {
		return chat.map(({ name, message }, index) => {
			const isOwnMessage = name === localData;
			return (
				<div 
					key={index} 
					style={{
						display: "flex",
						justifyContent: isOwnMessage ? "flex-end" : "flex-start",
						margin: "8px 0"
					}}
				>
					<div
						style={{
							maxWidth: "70%",
							backgroundColor: isOwnMessage ? "#4d67c3" : "#2e2e2e",
							color: "white",
							padding: "10px 15px",
							borderRadius: isOwnMessage ? "15px 15px 0 15px" : "15px 15px 15px 0",
							boxShadow: "0px 2px 5px rgba(0,0,0,0.3)"
						}}
					>
						<strong style={{ fontSize: "0.8rem", opacity: 0.8 }}>
							{isOwnMessage ? "You" : name}
						</strong>
						<p style={{ margin: "5px 0 0 0", fontSize: "1rem" }}>{message}</p>
					</div>
				</div>
			);
		});
	};

	return (
		<>
			<div 
				className="render-chat"
				style={{
					height: "400px",
					overflowY: "auto",
					padding: "1rem",
					backgroundColor: "#1c1c1c",
					borderRadius: "10px",
					border: "1px solid #444"
				}}
			>
				<h3 style={{ 
					color: 'white', 
					textAlign: 'center', 
					fontFamily: '\'Baloo Bhaijaan 2\', cursive', 
					borderBottom: '1px solid white', 
					marginBottom: '1rem' 
				}}>
					Chat Log
				</h3>
				{renderChat()}
				<div ref={scrollRef} />
			</div>

			{/* Form with Input */}
				<Form onSubmit={onMessageSubmit} style={{ marginTop: "12px" }}>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      width: "100%",
      backgroundColor: "#2a2a2a",
      borderRadius: "30px",
      padding: "4px",
      border: "1px solid #444",
    }}
  >
    <Form.Control
      name="message"
      type="text"
      onChange={onTextChange}
      value={state.message}
      placeholder="Type a message..."
      style={{
        flex: 1,
        border: "none",
        backgroundColor: "transparent",
        color: "white",
        padding: "12px 15px",
        borderRadius: "30px",
        outline: "none",
        boxShadow: "none",
      }}
    />
    <Button
      type="submit"
      style={{
        borderRadius: "50%",
        width: "45px",
        height: "45px",
        marginLeft: "5px",
        backgroundColor: "#4d67c3",
        border: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      ✈️
    </Button>
  </div>
</Form>


		</>
	);
};

export default Chat;
