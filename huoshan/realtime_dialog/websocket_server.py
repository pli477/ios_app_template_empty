# import json
# import asyncio
# from fastapi import FastAPI, WebSocket
# from fastapi.middleware.cors import CORSMiddleware

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # 你可以改成 ["http://localhost:5173"]
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# connected_clients = set()

# @app.websocket("/ws/asr")
# async def websocket_endpoint(websocket: WebSocket):
#     await websocket.accept()
#     print("前端已连接")
#     try:
#         # 前端发送消息协程（如果需要处理前端输入）
#         recv_task = asyncio.create_task(websocket.receive_text())

#         # 前端接收消息协程
#         send_task = asyncio.create_task(session.frontend_sender(websocket))

#         await asyncio.gather(recv_task, send_task)
#     except Exception as e:
#         print(f"WebSocket错误: {e}")
#     finally:
#         print("前端断开")
#         send_task.cancel()
#         recv_task.cancel()

# async def frontend_sender(self, websocket):
#     """把队列消息实时发送给前端"""
#     try:
#         while self.is_running or not self.frontend_queue.empty():
#             try:
#                 msg = await asyncio.wait_for(self.frontend_queue.get(), timeout=1.0)
#                 await websocket.send_bytes(msg)  # 二进制数据发送
#             except asyncio.TimeoutError:
#                 continue
#     except Exception as e:
#         print(f"前端发送错误: {e}")

import json
import asyncio
from fastapi import FastAPI, WebSocket
from typing import Optional

app = FastAPI()

current_session: Optional["DialogSession"] = None
current_task: Optional[asyncio.Task] = None


@app.websocket("/ws/control")
async def ws_control(websocket: WebSocket):
    global current_session, current_task
    await websocket.accept()
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "start":
                if current_task and not current_task.done():
                    await websocket.send_text("Service already running")
                    continue

                # 延迟导入，避免循环依赖
                from audio_manager import DialogSession
                import config

                # 创建 DialogSession
                current_session = DialogSession(ws_config=config.ws_connect_config, mod="audio")
                current_session.frontend_queue = asyncio.Queue()

                # 启动 session
                current_task = asyncio.create_task(current_session.start())
                # 启动消息转发任务
                forward_task = asyncio.create_task(forward_to_frontend(websocket, current_session))
                await asyncio.gather(current_task, forward_task)

                await websocket.send_text(json.dumps({"status": "Service started"}))

            elif msg == "stop":
                if current_session:
                    current_session.stop()
                    await websocket.send_text(json.dumps({"status": "Service stopped"}))
            else:
                await websocket.send_text(json.dumps({"status": "Unknown command: {msg}"}))

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if current_session:
            current_session.stop()
        if current_task:
            current_task.cancel()
        await websocket.close()


async def forward_to_frontend(websocket: WebSocket, session):
    """实时把 session 的 payload_msg 发送给前端"""
    try:
        while session.is_running or not session.frontend_queue.empty():
            try:
                msg = await asyncio.wait_for(session.frontend_queue.get(), timeout=1.0)
                await websocket.send_text(json.dumps(msg))
            except asyncio.TimeoutError:
                continue
    except Exception as e:
        print(f"前端发送错误: {e}")