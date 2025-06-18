from flask import Flask, Response, request
import time
import random
import json

app = Flask(__name__)

@app.route('/sse')
def sse():
    client_ip = request.remote_addr
    print(f"[SSE] New connection from: {client_ip}")

    def generate_events():
        try:
            for i in range(1, 11):  # 发送 10 条消息
                data = {
                    "count": i,
                    "time": time.strftime("%H:%M:%S"),
                    "random": random.random()
                }
                event_data = f"id: {i}\ndata: {json.dumps(data)}\n\n"
                yield event_data
                time.sleep(1)  # 每秒发送一次
            print(f"[SSE] Stream completed for {client_ip}")
        except GeneratorExit:
            print(f"[SSE] Client {client_ip} disconnected abruptly!")
            raise  # 重新抛出异常以正确关闭连接

    response = Response(
        generate_events(),
        mimetype="text/event-stream"
    )

    @response.call_on_close
    def on_close():
        print(f"[SSE] Connection closed for {client_ip}")

    return response

if __name__ == '__main__':
    # 修改 host='0.0.0.0' 允许局域网访问
    app.run(host='0.0.0.0', port=3008, debug=True)