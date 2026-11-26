const ALLOWED_ORIGIN = "https://bishsn.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "CART3R AI" }, { headers: cors });
    }

    if (origin && origin !== ALLOWED_ORIGIN) {
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers: cors });
    }

    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      return Response.json({ error: "Not found" }, { status: 404, headers: cors });
    }

    try {
      const body = await request.json();
      const incoming = Array.isArray(body.messages) ? body.messages : [];
      const messages = incoming
        .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
        .slice(-16)
        .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));

      if (!messages.length || !messages.some(m => m.role === "user")) {
        return Response.json({ error: "اكتب سؤالاً أولاً." }, { status: 400, headers: cors });
      }

      const result = await env.AI.run("@cf/google/gemma-4-26b-a4b-it", {
        messages: [
          {
            role: "system",
            content: "أنت CART3R AI، مساعد ذكي يتحدث العربية بوضوح، ويفضل اللهجة العراقية عندما تناسب المستخدم. أجب بدقة وبشكل عملي. لا تدّعِ أنك بحثت في الإنترنت أو قرأت ملفات لم تُرسل إليك. إذا لم تعرف، فقل ذلك بوضوح. لا تخترع مصادر أو روابط."
          },
          ...messages
        ],
        chat_template_kwargs: { enable_thinking: false }
      });

      const answer =
        result?.response ||
        result?.choices?.[0]?.message?.content ||
        result?.output_text ||
        "";

      if (!answer) {
        return Response.json({ error: "لم يرجع النموذج إجابة واضحة. حاول مرة أخرى." }, { status: 502, headers: cors });
      }

      return Response.json({ answer }, { headers: cors });
    } catch (error) {
      return Response.json(
        { error: "تعذر تنفيذ الطلب. تأكد من تفعيل Workers AI binding في إعدادات Worker." },
        { status: 500, headers: cors }
      );
    }
  }
};
