/* Small, explicit offline conversation support. This is not a language model. */
(() => {
 'use strict';
 const normalize = text => globalThis.PortfolioTools.normalize(text).trim();
 const sad = /\bbuon\b|co don|that vong|chan nan|met moi/;
 function reply(text, history = []) {
  const q = normalize(text);
  if (/tu tu|tu lam hai|khong muon song|muon chet/.test(q)) return {intent:'support',content:'Mình rất tiếc vì bạn đang đau khổ như vậy. Nếu bạn có thể làm hại bản thân hoặc đang gặp nguy hiểm, hãy liên hệ cấp cứu tại nơi bạn sống và nhờ một người bạn tin tưởng ở bên ngay lúc này. Bạn có đang ở một nơi an toàn không?'};
  if (/khong (con )?buon|do buon|vui hon/.test(q)) return {intent:'relief',content:'Nghe như bạn đang thấy nhẹ lòng hơn một chút. Có điều gì đã giúp bạn dễ chịu hơn không?'};
  if (sad.test(q)) return {intent:'sad',content:'Nghe có vẻ bạn đang có một ngày không dễ chịu. Bạn muốn kể điều gì làm bạn buồn không? Nếu chưa muốn kể, mình có thể cùng bạn nghĩ một việc nhỏ để thấy dễ chịu hơn.'};
  if (/lo lang|lo qua|ap luc|stress|cang thang/.test(q)) return {intent:'stress',content:'Có vẻ bạn đang phải lo nhiều thứ. Mình có thể nghe bạn chia sẻ. Điều gì đang khiến bạn áp lực nhất lúc này: việc học, công việc hay một chuyện khác?'};
  const previousUser = history.filter(m => m.role === 'user').slice(-2).map(m => normalize(m.content));
  const wasSad = previousUser.some(q => sad.test(q) || /lo lang|ap luc|stress/.test(q));
  if (wasSad && /thi truot|rot mon|diem (thap|kem)|truot ky thi/.test(q)) return {intent:'study-support',content:'Thi không như ý có thể khiến bạn hụt hẫng, nhất là khi đã cố gắng. Một lần thi không nói hết khả năng của bạn. Bạn muốn nghỉ một chút và kể thêm, hay cùng chia nhỏ phần cần ôn để chuẩn bị cho lần sau?'};
  if (wasSad && /khong biet|chang biet|khong muon ke|chua muon ke/.test(q)) return {intent:'support',content:'Không sao, bạn không cần giải thích ngay. Bạn có thể nghỉ một chút, uống ít nước hoặc nhắn cho một người bạn tin tưởng. Bạn muốn mình kể một chuyện vui ngắn hay cùng chọn một việc nhẹ để làm trước?'};
  if (wasSad && /^(vi|tai|minh bi|toi bi|chuyen la|do )/.test(q)) return {intent:'support',content:'Cảm ơn bạn đã kể thêm. Chuyện đó có vẻ đang khiến bạn nặng lòng. Bạn muốn mình tiếp tục nghe, hay cùng nghĩ một bước nhỏ mà bạn có thể làm lúc này?'};
  if (/ke (mot )?(cau )?chuyen vui|ke truyen cuoi|ke chuyen cuoi/.test(q)) return {intent:'joke',content:'Một lập trình viên đi ngủ, tự nhủ: “Mình chỉ sửa thêm một lỗi nữa thôi.” Sáng hôm sau, máy tính đã ngủ trước bạn ấy. 🙂 Bạn muốn nghe thêm hay quay lại chuyện đang làm bạn bận lòng?'};
  if (/^(chao|xin chao|hello|hi|hey)(\b|[ !?.])/.test(q)) return {intent:'greeting',content:'Chào bạn! Hôm nay bạn thế nào? Mình có thể trò chuyện cơ bản, giới thiệu về Bảo hoặc giúp bạn xem thời tiết, giờ và lịch.'};
  if (/cam on|thanks|thank you/.test(q)) return {intent:'thanks',content:'Không có gì nhé. Bạn muốn chia sẻ thêm hay cần mình giúp một việc khác?'};
  if (/\bvui\b|hanh phuc|hao hung/.test(q)) return {intent:'happy',content:'Nghe vui quá! Có chuyện gì khiến bạn vui hôm nay?'};
  if (/^(uk|uh|u|ok|oke|dong y|duoc|vang|da)[ !?.]*$/.test(q)) return {intent:'acknowledge',content:wasSad?'Mình đang nghe. Bạn có thể kể tiếp theo cách bạn thấy thoải mái.':'Bạn muốn mình giúp gì tiếp theo?'};
  return null;
 }
 globalThis.PortfolioConversation = Object.freeze({reply});
})();
