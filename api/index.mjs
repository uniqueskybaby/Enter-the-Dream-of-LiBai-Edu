import { handleEduRequest } from '../server/index.mjs';

export default async function handler(req, res) {
  await handleEduRequest(req, res);
}
