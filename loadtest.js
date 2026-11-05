import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Ramp-up to 50 concurrent virtual users
    { duration: '30s', target: 200 }, // Spike to 200 concurrent users
    { duration: '10s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of submissions accepted under 3s
  },
};

const payload = JSON.stringify({
  problem_id: 'two-sum',
  language: 'python',
  code: 'def two_sum(nums, target):\n    return [0, 1]\n',
  only_first_case: true,
});

const params = {
  headers: {
    'Content-Type': 'application/json',
  },
};

export default function () {
  const res = http.post('http://localhost:8080/api/submissions', payload, params);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has submission_id': (r) => JSON.parse(r.body).submission_id !== undefined,
  });
  sleep(0.1);
}

