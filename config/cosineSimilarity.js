import cosineSimilarity from 'compute-cosine-similarity';

export const getHobbySimilarity = (userHobbies, groupHobbies) => {
    if (!userHobbies || !groupHobbies || userHobbies.length === 0 || groupHobbies.length === 0) {
      console.log("Một trong hai danh sách sở thích là rỗng hoặc không hợp lệ.");
      return 0; // Nếu một trong hai danh sách trống, độ tương đồng là 0
    }
  
    // Lọc bỏ các giá trị undefined hoặc null từ cả hai danh sách sở thích
    const validUserHobbies = userHobbies.filter(hobby => hobby !== undefined && hobby !== null);
    const validGroupHobbies = groupHobbies.filter(hobby => hobby !== undefined && hobby !== null);
  
    console.log("Sở thích của người dùng:", validUserHobbies);
    console.log("Sở thích của nhóm:", validGroupHobbies);
  
    // Bước 1: Hợp nhất tất cả các sở thích thành một tập hợp duy nhất
    const allHobbies = [...new Set([...validUserHobbies, ...validGroupHobbies])];
    console.log("Tập hợp sở thích chung (allHobbies):", allHobbies);
  
    // Bước 2: Biểu diễn userHobbies và groupHobbies dưới dạng vector
    const userVector = allHobbies.map(hobby => (validUserHobbies.includes(hobby) ? 1 : 0));
    console.log("Vector của người dùng (userVector):", userVector);
  
    const groupVector = allHobbies.map(hobby => (validGroupHobbies.includes(hobby) ? 1 : 0));
    console.log("Vector của nhóm (groupVector):", groupVector);
  
    // Bước 3: Kiểm tra xem vector có hợp lệ không (không có NaN hoặc giá trị không hợp lệ)
    if (userVector.includes(NaN) || groupVector.includes(NaN)) {
      console.log("Có giá trị NaN trong các vector. Đảm bảo rằng các sở thích hợp lệ.");
      return 0; // Nếu có NaN, trả về 0
    }
  
    // Bước 4: Tính cosine similarity giữa userVector và groupVector
    const similarity = cosineSimilarity(userVector, groupVector);
    console.log("Cosine similarity:", similarity);
  
    return similarity;
  };