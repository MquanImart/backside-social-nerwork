import mongoose from 'mongoose';
import Hobby from  '../models/Hobby.js'

const getAllHobby = async () => {
    const hooby = await Hobby.find();
    return hooby;
}

export const hobbyService = {
    getAllHobby,
}