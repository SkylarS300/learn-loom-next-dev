// lib/livePing.js
export function startLivePing({ classroomId, mode, intervalMs = 20000 }) {
    let timer = null;
    const hit = async () => {
        try {
            await fetch(`/api/classrooms/${classroomId}/live/ping`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
                cache: "no-store",
            });
        } catch { }
    };
    hit();
    timer = setInterval(hit, intervalMs);
    return () => timer && clearInterval(timer);
}
