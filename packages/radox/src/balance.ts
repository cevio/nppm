import { Agent } from './agent';
import { P2cBalancer } from 'load-balancers';

function normal(agents: Agent[], method: string): Agent {
  if (agents.length === 1) return agents[0];
  return agents.find(agent => agent.hasMethod(method));
}

function random(agents: Agent[], method: string): Agent {
  const _agents = agents.filter(agent => agent.hasMethod(method));
  if (_agents.length === 1) return _agents[0];
  const balancer = new P2cBalancer(_agents.length);
  return _agents[balancer.pick()];
}

function hit(agents: Agent[], method: string): Agent {
  const _agents = agents.filter(agent => agent.hasMethod(method));
  if (_agents.length === 1) return _agents[0];
  let agent: Agent = null
  for (let i = 0; i < _agents.length; i++) {
    const _agent = _agents[i];
    if (!agent) {
      agent = _agent;
      continue;
    }
    if (agent.hits > _agent.hits) {
      agent = _agent;
    }
  }
  return agent;
}

export const balances: Record<'default' | 'rdm' | 'hit', (agents: Agent[], method: string) => Agent> = {
  default: normal,
  rdm: random,
  hit: hit,
}