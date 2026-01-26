const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: "sk-csNNE8EKd3PDMqcExPDaIg",
    baseURL: "https://gate.epaphrodit.us/v1",
});

async function test() {
    console.log("Testing DeepSeek connection...");
    try {
        const response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "user", content: "What is the benchmark score for student 12345?" }
            ],
            tools: [
                {
                    type: "function",
                    function: {
                        name: "get_student_score",
                        description: "Get the benchmark score for a student",
                        parameters: {
                            type: "object",
                            properties: {
                                student_id: { type: "string" }
                            },
                            required: ["student_id"]
                        }
                    }
                }
            ],
            tool_choice: "auto"
        });

        console.log("Response received:");
        console.log(JSON.stringify(response, null, 2));

        if (response.choices[0].message.tool_calls) {
            console.log("SUCCESS: Tool calls generated correctly.");
        } else {
            console.log("WARNING: No tool calls generated. Model might not support tools or decided not to use them.");
        }

    } catch (error) {
        console.error("ERROR:", error);
    }
}

test();
