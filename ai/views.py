import textwrap

import google.generativeai as genai
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _format_context(context):
    if not isinstance(context, dict):
        return ""
    lines = []
    name = (context.get("habitName") or "").strip()
    if name:
        lines.append(f"- Goal name: {name}")
    desc = (context.get("habitDescription") or "").strip()
    if desc:
        lines.append(f"- Goal description: {desc}")
    sel = (context.get("selectedDate") or "").strip()
    if sel:
        lines.append(f"- Selected day (YYYY-MM-DD): {sel}")
    g0 = (context.get("goalStartDate") or "").strip()
    g1 = (context.get("goalEndDate") or "").strip()
    if g0 or g1:
        lines.append(f"- Goal period: {g0 or '?'} … {g1 or '?'}")
    existing = context.get("existingTasks")
    if isinstance(existing, list) and existing:
        parts = []
        for t in existing[:20]:
            if not isinstance(t, dict):
                continue
            tx = (t.get("text") or "").strip()
            st = (t.get("startTime") or "").strip()
            en = (t.get("endTime") or "").strip()
            if tx:
                parts.append(f"  • {tx} ({st}–{en})" if st or en else f"  • {tx}")
        if parts:
            lines.append("- Already planned this day:")
            lines.extend(parts)
    if not lines:
        return ""
    return "Context:\n" + "\n".join(lines)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_chat_view(request):
    user_message = (request.data.get("message") or "").strip()
    if not user_message:
        return Response({"error": "message is required"}, status=400)

    api_key = (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
    if not api_key:
        return Response(
            {
                "error": "Gemini is not configured",
                "detail": "Set GEMINI_API_KEY or GOOGLE_API_KEY in the server environment.",
            },
            status=503,
        )

    ctx_block = _format_context(request.data.get("context"))
    # The user input is treated as optional extra goal details / notes.
    # Execution date must come from context only (selectedDate).
    full_prompt = (
        f"{ctx_block}\n\nAdditional goal details / notes (optional):\n{user_message}".strip()
        if ctx_block
        else user_message
    )

    system_instruction = textwrap.dedent(
        """\
        You help users plan concrete tasks for a single calendar day inside a habit-tracking app.
        They have a long-term goal (habit) and pick one date to fill with tasks.
        Reply in the same language as the user.
        ALWAYS base the plan on the provided context (goal name/description + selected day + existing tasks).
        Execution date MUST be taken from the context `selectedDate` only.
        Ignore any dates mentioned in the user's message. (Example: if user writes "17 April", still plan for `selectedDate`.)
        Suggest 4–7 specific, actionable tasks. For each, optionally give a time window as HH:MM–HH:MM (24h).
        Use a clear numbered list only.
        If tasks for that day are already listed in context, avoid duplicating them; you may refine or add what is missing.
        Do not ask them to log in or use external tools; only output the task suggestions and brief encouragement.
        """
    ).strip()

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash"),
            system_instruction=system_instruction,
        )
        response = model.generate_content(full_prompt)
        reply = ""
        try:
            reply = (response.text or "").strip()
        except (ValueError, AttributeError):
            if response.candidates:
                cand = response.candidates[0]
                if cand.content and cand.content.parts:
                    reply = "".join(
                        getattr(p, "text", "") or "" for p in cand.content.parts
                    ).strip()
        if not reply:
            return Response({"error": "Empty model response"}, status=502)
        return Response({"reply": reply})
    except Exception as e:
        return Response({"error": str(e)}, status=502)
