import { getUserFromReq } from '../_auth.js'

export default function handler(req, res){
  const user = getUserFromReq(req)
  if(!user) return res.status(200).json(null)
  // Return safe fields
  return res.status(200).json({ id: user.id, username: user.username, discriminator: user.discriminator, isEditor: !!user.isEditor })
}
