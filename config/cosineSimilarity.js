import cosineSimilarity from 'compute-cosine-similarity';

export const getHobbySimilarity = (userHobbies, comparedHobbies) => {
  if (!userHobbies || !comparedHobbies || userHobbies.length === 0 || comparedHobbies.length === 0) {
    console.log("Một trong hai danh sách sở thích là rỗng hoặc không hợp lệ.");
    return 0; // Nếu một trong hai danh sách trống, độ tương đồng là 0
  }

  // Bước 1: Tạo một danh sách chung các sở thích mà không loại bỏ trùng lặp
  const allHobbies = [...userHobbies, ...comparedHobbies];
  console.log("Tập hợp sở thích chung (allHobbies):", allHobbies);

  // Bước 2: Tạo các vector cho người dùng và đối tượng so sánh (người dùng hoặc nhóm)
  const userVector = allHobbies.map(hobby => (userHobbies.includes(hobby) ? 1 : 0));
  const comparedVector = allHobbies.map(hobby => (comparedHobbies.includes(hobby) ? 1 : 0));

  console.log("Vector của người dùng (userVector):", userVector);
  console.log("Vector của đối tượng so sánh (comparedVector):", comparedVector);

  // Bước 3: Tính Cosine similarity sử dụng hàm từ thư viện
  const similarity = cosineSimilarity(userVector, comparedVector);
  console.log("Cosine similarity:", similarity);

  return similarity;
};


