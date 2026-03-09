# Mozi

## target

* mission planning features
    1. cpu, gpu, memory, i/o, peripherals infos on agent app
    2. task planning (general/professional/top-level/low-level),
     and dynamic adjustment (self-correcting with RL)
    3. support text, pictures, voice, and video forms
    4. agent's factory (workflow, langchain)
    5. tools （fs/shell/fetch/auto llm/info extraction/log/askUser/sandbox/message channel/sound/visual）
    6. skills (fetch info/policy/err handing/interactive system/memory)
    7. context (perception subsys/action subsys/policy subsys)
    8. subagent
    9. agent swarm (collaboration/master-slave)

* tts model, virsion model(moe model), language model
    1. Use DeepSeek-R1 as the inference language model
    2. Deployment Reasoning Optimization-vllm
    3. Fine tuning-RL

* task plan agent
    1. tools sdk
    2. rag + cot + workflow + rl-online
    3. mcp + skills

## plan - v0.1.0

* Support text interaction, personalization and internationalization.
* deepseek-1b, qwen32b deployment and vllm optimization
* search tool, rag


##  Technology stack

### front end
    * react, tailwindcss, zustand, shadcn, vite
    * docker

### backend end
    * rust, cargo, devcontainer, microservices
    * docker


### misc

* use node 22
* config proxy
* start with NO_PROXY=localhost,127.0.0.1 npm run tauri:dev on wsl2
