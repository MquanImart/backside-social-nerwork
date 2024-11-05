import { hobbyService } from '../services/hobbyService.js'

const getAllHobby = async (req, res) => {
    try {
      const hobbies = await hobbyService.getAllHobby()
      res.status(200).json(hobbies)
    } catch (error) {
      res.status(500).json({ error: 'Failed to get hobbies' })
    }
  }

export const hobbyController = {
    getAllHobby
}
