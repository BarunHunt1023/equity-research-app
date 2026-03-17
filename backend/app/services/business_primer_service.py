"""Business Overview Skill — invokes the Business-Overview-Skill-v6 via Claude's Skills API."""

import anthropic
from app.config import get_anthropic_key

SKILL_ID = "skill_01XbT5PPBLvAZmsnYWNUtUNn"


def run_business_overview_skill(company_name: str, data_summary: str = "") -> str:
    """Invoke the Business Overview Skill and return the final business primer as text."""
    client = anthropic.Anthropic(api_key=get_anthropic_key())

    user_message = (
        f"Produce a 16-page Business and Industry Primer for {company_name}."
    )
    if data_summary:
        user_message += f"\n\nFINANCIAL DATA:\n{data_summary}"

    response = client.beta.messages.create(
        model="claude-opus-4-6",
        max_tokens=8192,
        betas=["code-execution-2025-08-25", "skills-2025-10-02"],
        container={
            "skills": [{"type": "custom", "skill_id": SKILL_ID}]
        },
        messages=[{"role": "user", "content": user_message}],
        tools=[{"type": "code_execution_20250825", "name": "code_execution"}],
    )

    # Extract all text blocks from the response
    text_parts = []
    for block in response.content:
        if hasattr(block, "type") and block.type == "text":
            text_parts.append(block.text)

    return "\n\n".join(text_parts) if text_parts else ""
