/**
 * Custom LXG Esports - Streamlined Registration Logic
 * - Chọn Loại Phòng Custom (Custom Cỏ 6K / Custom Phòng Giải 25K + Cơ Cấu Giải Thưởng)
 * - Chọn Khung Giờ Thi Đấu & Số Lượng Slot
 * - Bấm Nút Xác Nhận Lớn -> Tự động sao chép tin nhắn đăng ký và chuyển hướng sang Zalo Admin 0702.774.507
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Slot & Pricing
  const soSlotInput = document.getElementById('soSlot');
  const btnMinusSlot = document.getElementById('btnMinusSlot');
  const btnPlusSlot = document.getElementById('btnPlusSlot');

  // Summary Elements
  const summaryTypeName = document.getElementById('summaryTypeName');
  const summaryTime = document.getElementById('summaryTime');
  const summarySlots = document.getElementById('summarySlots');
  const summaryTotal = document.getElementById('summaryTotal');

  // Mobile Sticky Bar Elements
  const stickyTotalAmount = document.getElementById('stickyTotalAmount');
  const stickySlotBadge = document.getElementById('stickySlotBadge');
  const btnStickyAction = document.getElementById('btnStickyAction');

  // Action Buttons
  const btnSubmit = document.getElementById('btnSubmit');
  const floatingZaloBtn = document.getElementById('floatingZaloBtn');

  // Modal Bảng Luật Thi Đấu
  const popupLuat = document.getElementById('popupLuat');
  const btnOpenLuat = document.getElementById('btnOpenLuat');
  const btnCloseLuatModal = document.getElementById('btnCloseLuatModal');
  const btnConfirmLuat = document.getElementById('btnConfirmLuat');

  // Modal Hệ Thống Box Zalo
  const boxZaloModal = document.getElementById('boxZaloModal');
  const btnOpenBoxModal = document.getElementById('btnOpenBoxModal');
  const btnCloseBoxModal = document.getElementById('btnCloseBoxModal');

  // Modal Thông Báo / Zalo Preview
  const successModal = document.getElementById('successModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnNewReg = document.getElementById('btnNewReg');
  const modalCustomInfo = document.getElementById('modalCustomInfo');
  const modalAmount = document.getElementById('modalAmount');
  const modalZaloPreviewMsg = document.getElementById('modalZaloPreviewMsg');
  const btnCopyZaloMsg = document.getElementById('btnCopyZaloMsg');

  // Toast Notification
  const toastNotice = document.getElementById('toastNotice');
  const toastMsg = document.getElementById('toastMsg');
  let toastTimer = null;

  // Session State
  let currentPricePerSlot = 6000;
  let currentTypeName = 'Custom Cỏ';
  const ADMIN_ZALO_LINK = 'https://zalo.me/0702774507';

  /* ==========================================================================
     1. LocalStorage Lưu & Khôi Phục Lựa Chọn
     ========================================================================== */
  const STORAGE_KEY = 'lxg_registration_state';

  function saveFormDataToStorage() {
    try {
      const selectedCustomRadio = document.querySelector('input[name="customType"]:checked');
      const selectedTimeRadio = document.querySelector('input[name="matchTime"]:checked');

      const data = {
        loaiCustomId: selectedCustomRadio ? selectedCustomRadio.id : 'typeCo',
        soSlot: soSlotInput ? soSlotInput.value : '1',
        matchTime: selectedTimeRadio ? selectedTimeRadio.value : '13h',
        savedAt: Date.now()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Lỗi khi lưu localStorage:', e);
    }
  }

  function restoreFormDataFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      // 1. Khôi phục Số lượng slot
      if (data.soSlot && soSlotInput) {
        const slotVal = parseInt(data.soSlot, 10);
        if (!isNaN(slotVal) && slotVal >= 1 && slotVal <= 10) {
          soSlotInput.value = slotVal;
        }
      }

      // 2. Khôi phục Loại phòng Custom
      if (data.loaiCustomId) {
        const targetRadio = document.getElementById(data.loaiCustomId);
        if (targetRadio) {
          customCards.forEach(c => {
            c.classList.remove('selected');
            const r = c.querySelector('input[type="radio"]');
            if (r) r.checked = false;
          });

          targetRadio.checked = true;
          const parentCard = targetRadio.closest('.custom-card');
          if (parentCard) parentCard.classList.add('selected');

          currentPricePerSlot = parseInt(targetRadio.dataset.price, 10) || 6000;
          currentTypeName = targetRadio.dataset.name || 'Custom Cỏ';
          updateCustomCardIndicators();
        }
      }

      // 3. Khôi phục Khung giờ thi đấu
      if (data.matchTime) {
        const targetTime = document.querySelector(`input[name="matchTime"][value="${data.matchTime}"]`);
        if (targetTime) {
          timeSlotInputs.forEach(t => { t.checked = false; });
          targetTime.checked = true;
          if (summaryTime) {
            summaryTime.textContent = targetTime.value;
          }
        }
      }

      calculateTotal();
    } catch (e) {
      console.warn('Lỗi khi khôi phục localStorage:', e);
    }
  }

  /* ==========================================================================
     2. Helper Functions
     ========================================================================== */
  function formatVND(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount);
  }

  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    if (toastMsg) toastMsg.textContent = message;
    if (toastNotice) toastNotice.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      if (toastNotice) toastNotice.classList.add('hidden');
    }, 3500);
  }

  window.copyToClipboard = function(elementId, successText) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.textContent.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successText || 'Đã sao chép vào bộ nhớ tạm!');
      }).catch(() => {
        showToast('Đã sao chép vào bộ nhớ tạm!');
      });
    }
  };

  /* ==========================================================================
     3. Tính Toán Chi Phí & Cập Nhật Tóm Tắt
     ========================================================================== */
  function calculateTotal() {
    const slots = parseInt(soSlotInput ? soSlotInput.value : 1, 10) || 1;
    const total = currentPricePerSlot * slots;

    // Cập nhật tóm tắt chi phí
    if (summaryTypeName) summaryTypeName.textContent = currentTypeName;
    if (summarySlots) summarySlots.textContent = `${slots} slot`;
    if (summaryTotal) summaryTotal.textContent = formatVND(total);

    // Cập nhật Mobile Sticky Bar
    if (stickyTotalAmount) {
      stickyTotalAmount.textContent = `${formatVND(total)} VNĐ`;
    }
    if (stickySlotBadge) {
      stickySlotBadge.textContent = `${slots} slot`;
    }
  }

  // Tăng / Giảm slot
  if (btnMinusSlot && soSlotInput) {
    btnMinusSlot.addEventListener('click', () => {
      let count = parseInt(soSlotInput.value, 10) || 1;
      if (count > 1) {
        soSlotInput.value = count - 1;
        calculateTotal();
        saveFormDataToStorage();
      }
    });
  }

  if (btnPlusSlot && soSlotInput) {
    btnPlusSlot.addEventListener('click', () => {
      let count = parseInt(soSlotInput.value, 10) || 1;
      if (count < 10) {
        soSlotInput.value = count + 1;
        calculateTotal();
        saveFormDataToStorage();
      }
    });
  }

  if (soSlotInput) {
    soSlotInput.addEventListener('input', () => {
      let count = parseInt(soSlotInput.value, 10);
      if (isNaN(count) || count < 1) count = 1;
      if (count > 10) count = 10;
      soSlotInput.value = count;
      calculateTotal();
      saveFormDataToStorage();
    });

    soSlotInput.addEventListener('change', () => {
      calculateTotal();
      saveFormDataToStorage();
    });
  }

  /* ==========================================================================
     4. Chọn Loại Phòng Custom & Bảng Cơ Cấu Giải Thưởng
     ========================================================================== */
  const customCards = document.querySelectorAll('.custom-card');
  const prizeStructureCard = document.getElementById('prizeStructureCard');

  function updateCustomCardIndicators() {
    const isGiai = document.getElementById('typeGiai')?.checked;
    if (prizeStructureCard) {
      if (isGiai) {
        prizeStructureCard.classList.add('active-highlight');
      } else {
        prizeStructureCard.classList.remove('active-highlight');
      }
    }

    customCards.forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      const isSelected = radio ? radio.checked : card.classList.contains('selected');
      const indicator = card.querySelector('.select-indicator');
      if (isSelected) {
        card.classList.add('selected');
        if (indicator) indicator.innerHTML = '<span class="indicator-dot">●</span> Đang chọn';
      } else {
        card.classList.remove('selected');
        if (indicator) indicator.innerHTML = 'Chọn phòng này';
      }
    });
  }

  customCards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    
    card.addEventListener('click', () => {
      customCards.forEach(c => {
        c.classList.remove('selected');
        const r = c.querySelector('input[type="radio"]');
        if (r) r.checked = false;
      });
      card.classList.add('selected');
      if (radio) radio.checked = true;

      currentPricePerSlot = parseInt(radio.dataset.price, 10);
      currentTypeName = radio.dataset.name; // "Custom Cỏ" hoặc "Custom Phòng Giải"

      updateCustomCardIndicators();
      calculateTotal();
      saveFormDataToStorage();
    });
  });

  // Bấm vào Khung Cơ Cấu Giải Thưởng -> Tự động chuyển chọn Custom Phòng Giải
  if (prizeStructureCard) {
    prizeStructureCard.addEventListener('click', () => {
      const giaiCard = document.querySelector('label[for="typeGiai"]');
      if (giaiCard) {
        giaiCard.click();
        showToast('🏆 Bạn đang chọn Custom Phòng Giải 25K/slot!');
      }
    });
  }

  /* ==========================================================================
     5. Chọn Khung Giờ Thi Đấu
     ========================================================================== */
  const timeSlotInputs = document.querySelectorAll('input[name="matchTime"]');
  timeSlotInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) {
        if (summaryTime) summaryTime.textContent = e.target.value;
        saveFormDataToStorage();
      }
    });
  });

  /* ==========================================================================
     6. Xử Lý Xác Nhận Đăng Ký & Mở Zalo Với Tin Nhắn Soạn Sẵn
     ========================================================================== */
  function handleConfirmZaloRegistration() {
    const slots = parseInt(soSlotInput ? soSlotInput.value : 1, 10) || 1;
    const selectedTimeRadio = document.querySelector('input[name="matchTime"]:checked');
    const selectedTimeVal = selectedTimeRadio ? selectedTimeRadio.value : '13h';
    const totalVND = formatVND(currentPricePerSlot * slots);

    // Nội dung tin nhắn chuẩn tự động soạn sẵn theo yêu cầu:
    // "Tôi muốn đăng ký [Tên gói phòng vừa chọn] vào khung giờ [Giờ chọn]"
    const zaloMsg = `Tôi muốn đăng ký ${currentTypeName} vào khung giờ ${selectedTimeVal} (Số lượng: ${slots} slot - Tổng tiền: ${totalVND} VNĐ). Nhờ Admin xếp slot cho tôi nhé!`;

    // 1. Tự động sao chép tin nhắn vào clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(zaloMsg).catch(() => {});
    }

    // 2. Điền thông tin vào Modal xác nhận
    if (modalCustomInfo) {
      modalCustomInfo.textContent = `${currentTypeName} (${selectedTimeVal})`;
    }
    if (modalAmount) {
      modalAmount.textContent = `${slots} slot - ${totalVND} VNĐ`;
    }
    if (modalZaloPreviewMsg) {
      modalZaloPreviewMsg.textContent = zaloMsg;
    }

    // 3. Hiển thị thông báo Toast
    showToast('✅ Đã sao chép tin nhắn! Đang mở Zalo Admin 0702.774.507...');

    // 4. Mở cửa sổ chat Zalo trực tiếp với Admin (0702.774.507)
    window.open(ADMIN_ZALO_LINK, '_blank', 'noopener,noreferrer');

    // 5. Hiển thị Popup Modal trên web để tiện copy lại hoặc mở lại Zalo nếu bị chặn popup
    if (successModal) {
      successModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  // Gán sự kiện cho Nút Xác Nhận Lớn
  if (btnSubmit) {
    btnSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      handleConfirmZaloRegistration();
    });
  }

  // Gán sự kiện cho Nút Sticky Bar trên Mobile
  if (btnStickyAction) {
    btnStickyAction.addEventListener('click', (e) => {
      e.preventDefault();
      handleConfirmZaloRegistration();
    });
  }

  /* ==========================================================================
     7. Floating Chat Zalo (Nút bóng tròn hỗ trợ góc phải dưới)
     ========================================================================== */
  if (floatingZaloBtn) {
    floatingZaloBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(ADMIN_ZALO_LINK, '_blank', 'noopener,noreferrer');
    });
  }

  /* ==========================================================================
     8. Modal Bảng Luật Thi Đấu
     ========================================================================== */
  function openLuatModal() {
    if (popupLuat) {
      popupLuat.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeLuatModal() {
    if (popupLuat) {
      popupLuat.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  if (btnOpenLuat) {
    btnOpenLuat.addEventListener('click', (e) => {
      e.preventDefault();
      openLuatModal();
    });
  }

  if (btnCloseLuatModal) btnCloseLuatModal.addEventListener('click', closeLuatModal);
  if (btnConfirmLuat) btnConfirmLuat.addEventListener('click', closeLuatModal);

  if (popupLuat) {
    popupLuat.addEventListener('click', (e) => {
      if (e.target === popupLuat) closeLuatModal();
    });
  }

  /* ==========================================================================
     9. Modal Hệ Thống Box Zalo Cộng Đồng
     ========================================================================== */
  function openBoxModal() {
    if (boxZaloModal) {
      boxZaloModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeBoxModal() {
    if (boxZaloModal) {
      boxZaloModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  if (btnOpenBoxModal) {
    btnOpenBoxModal.addEventListener('click', (e) => {
      e.preventDefault();
      openBoxModal();
    });
  }

  if (btnCloseBoxModal) btnCloseBoxModal.addEventListener('click', closeBoxModal);

  if (boxZaloModal) {
    boxZaloModal.addEventListener('click', (e) => {
      if (e.target === boxZaloModal) closeBoxModal();
    });
  }

  /* ==========================================================================
     10. Modal Success / Zalo Preview & Keyboard Events
     ========================================================================== */
  function closeSuccessModal() {
    if (successModal) {
      successModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeSuccessModal);
  if (btnNewReg) btnNewReg.addEventListener('click', closeSuccessModal);

  if (successModal) {
    successModal.addEventListener('click', (e) => {
      if (e.target === successModal) closeSuccessModal();
    });
  }

  // Nút sao chép lại nội dung tin nhắn gửi Zalo trong modal
  if (btnCopyZaloMsg) {
    btnCopyZaloMsg.addEventListener('click', () => {
      if (modalZaloPreviewMsg && modalZaloPreviewMsg.textContent) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(modalZaloPreviewMsg.textContent).then(() => {
            showToast('✅ Đã sao chép tin nhắn!');
          }).catch(() => {
            showToast('✅ Đã sao chép tin nhắn!');
          });
        }
      }
    });
  }

  // Đóng modal bằng phím Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (boxZaloModal && !boxZaloModal.classList.contains('hidden')) closeBoxModal();
      if (popupLuat && !popupLuat.classList.contains('hidden')) closeLuatModal();
      if (successModal && !successModal.classList.contains('hidden')) closeSuccessModal();
    }
  });

  /* ==========================================================================
     11. Khởi Tạo Trạng Thái Ban Đầu
     ========================================================================== */
  updateCustomCardIndicators();
  calculateTotal();
  restoreFormDataFromStorage();

  /* ==========================================================================
     12. Xử Lý Tương Tác Minigame Đua Vịt Siêu Tốc (5 Vịt Vàng - Đua 15-20s - 1 Ăn 5)
     ========================================================================== */

  // Helper mở Zalo nạp cược & sao chép lời nhắn
  function handleZaloDuckDeposit(stakeAmount) {
    const stakeText = stakeAmount === 10000 ? '10.000đ' : '5.000đ';
    // Cú pháp chuẩn theo yêu cầu:
    // 'Chào Admin, tôi muốn nạp [Số tiền 5k hoặc 10k] để đặt cược đua vịt. Tôi gửi bill xác nhận nhé!'
    const zaloMsg = `Chào Admin, tôi muốn nạp ${stakeText} để đặt cược đua vịt. Tôi gửi bill xác nhận nhé!`;

    // 1. Sao chép tin nhắn vào bộ nhớ tạm
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(zaloMsg).catch(() => {});
    }

    // 2. Điền thông tin vào Modal xác nhận dự phòng
    if (modalCustomInfo) {
      modalCustomInfo.textContent = `Đua Vịt Siêu Tốc (${currentSelectedDuckName})`;
    }
    if (modalAmount) {
      modalAmount.textContent = `${stakeText} (Thắng nhận: ${formatVND(stakeAmount * 5)} VNĐ)`;
    }
    if (modalZaloPreviewMsg) {
      modalZaloPreviewMsg.textContent = zaloMsg;
    }

    // 3. Thông báo Toast
    showToast(`✅ Đã sao chép: "${zaloMsg}"! Đang chuyển đến Zalo Admin 0702.774.507...`);

    // 4. Mở tab mới Zalo Admin
    window.open(ADMIN_ZALO_LINK, '_blank', 'noopener,noreferrer');

    // 5. Hiển thị popup modal dự phòng
    if (successModal) {
      successModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  // ==========================================================================
  // 12. TÍCH HỢP LIVESTREAM YOUTUBE & OPTIONAL AUTH & ĐUA VỊT 45S TỰ ĐỘNG
  // ==========================================================================

  // --- 12.1 LIVESTREAM YOUTUBE TỰ ĐỘNG CẬP NHẬT TỪ ADMIN & FILE CẤU HÌNH ---
  const youtubeLiveIframe = document.getElementById('youtubeLiveIframe');
  const btnOpenYoutubeExt = document.getElementById('btnOpenYoutubeExt');
  const streamVideoStatusText = document.getElementById('streamVideoStatusText');

  function applyLivestreamVideo(videoId) {
    if (!videoId) return;
    const embedUrl = 'https://www.youtube.com/embed/' + videoId + '?autoplay=0&rel=0&modestbranding=1';
    const watchUrl = 'https://www.youtube.com/watch?v=' + videoId;

    if (youtubeLiveIframe && youtubeLiveIframe.src !== embedUrl) {
      youtubeLiveIframe.src = embedUrl;
    }
    if (btnOpenYoutubeExt) {
      btnOpenYoutubeExt.href = watchUrl;
    }
    if (streamVideoStatusText) {
      streamVideoStatusText.innerHTML = 'Đang phát trực tiếp từ YouTube Channel • Video ID: <strong>' + videoId + '</strong>';
    }
  }

  function syncLivestreamConfig() {
    // 1. Kiểm tra localStorage trước (Ưu tiên cập nhật mới nhất từ Admin)
    const storedConfig = localStorage.getItem('lxg_stream_config');
    let hasApplied = false;

    if (storedConfig) {
      try {
        const parsed = JSON.parse(storedConfig);
        if (parsed && parsed.videoId) {
          applyLivestreamVideo(parsed.videoId);
          hasApplied = true;
        }
      } catch (e) {}
    }

    // 2. Tự động đọc file cấu hình stream_config.json
    fetch('stream_config.json?v=' + Date.now())
      .then(res => {
        if (!res.ok) throw new Error('Could not load stream_config.json');
        return res.json();
      })
      .then(data => {
        if (data && data.videoId) {
          // Nếu chưa có trong localStorage hoặc file cấu hình mới hơn
          if (!hasApplied) {
            applyLivestreamVideo(data.videoId);
            localStorage.setItem('lxg_stream_config', JSON.stringify(data));
          }
        }
      })
      .catch(err => {
        // Fallback mặc định
        if (!hasApplied) {
          applyLivestreamVideo('1mTGJ7IUhR4');
        }
      });
  }

  // Khởi động load Livestream
  syncLivestreamConfig();

  // Lắng nghe sự kiện đồng bộ khi Admin bấm LƯU LINK LIVE ở tab admin.html
  window.addEventListener('storage', (e) => {
    if (e.key === 'lxg_stream_config') {
      syncLivestreamConfig();
    }
  });


  // --- 12.2 HỆ THỐNG ĐĂNG KÝ / ĐĂNG NHẬP TÙY CHỌN (OPTIONAL AUTH) ---
  const authModal = document.getElementById('authModal');
  const btnCloseAuthModal = document.getElementById('btnCloseAuthModal');
  const authModalGameIdInput = document.getElementById('authModalGameIdInput');
  const btnAuthConfirm = document.getElementById('btnAuthConfirm');
  const authActiveUserBox = document.getElementById('authActiveUserBox');
  const authActiveUserText = document.getElementById('authActiveUserText');
  const authActiveUserBal = document.getElementById('authActiveUserBal');
  const btnAuthLogout = document.getElementById('btnAuthLogout');

  // Top Nav Auth Button
  const btnHeaderAuth = document.getElementById('btnHeaderAuth');
  const navAuthLabel = document.getElementById('navAuthLabel');

  // Duck User Bar Elements
  const duckUserGuestWrap = document.getElementById('duckUserGuestWrap');
  const btnGuestOpenAuth = document.getElementById('btnGuestOpenAuth');
  const duckUserLoggedWrap = document.getElementById('duckUserLoggedWrap');
  const duckCurrentIdText = document.getElementById('duckCurrentIdText');
  const duckUserBalanceText = document.getElementById('duckUserBalanceText');
  const btnDuckOpenDeposit = document.getElementById('btnDuckOpenDeposit');
  const btnDuckChangeId = document.getElementById('btnDuckChangeId');

  function getLxgCurrentId() {
    return (localStorage.getItem('lxg_current_id') || '').trim();
  }

  function getLxgUserBalance(id) {
    if (!id) return 0;
    try {
      const users = JSON.parse(localStorage.getItem('lxg_users') || '{}');
      return typeof users[id] === 'number' ? users[id] : 0;
    } catch (e) {
      return 0;
    }
  }

  function setLxgUserBalance(id, newBalance) {
    if (!id) return;
    try {
      const users = JSON.parse(localStorage.getItem('lxg_users') || '{}');
      users[id] = Math.max(0, parseInt(newBalance, 10) || 0);
      localStorage.setItem('lxg_users', JSON.stringify(users));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error(e);
    }
  }

  function registerLxgUser(id) {
    id = (id || '').trim();
    if (!id) return false;
    localStorage.setItem('lxg_current_id', id);
    try {
      const users = JSON.parse(localStorage.getItem('lxg_users') || '{}');
      if (users[id] === undefined) {
        users[id] = 0; // Khởi tạo 0đ nếu là tài khoản mới
        localStorage.setItem('lxg_users', JSON.stringify(users));
      }
    } catch (e) {}

    renderAuthAndUserUI();
    window.dispatchEvent(new Event('storage'));
    return true;
  }

  function logoutLxgUser() {
    localStorage.removeItem('lxg_current_id');
    renderAuthAndUserUI();
    window.dispatchEvent(new Event('storage'));
    showToast('👋 Đã đăng xuất ID Game. Bạn đang xem với tư cách Khách vãng lai.');
  }

  function renderAuthAndUserUI() {
    const currentId = getLxgCurrentId();
    const balance = getLxgUserBalance(currentId);
    const formattedBalance = formatVND(balance);

    // 1. Cập nhật Top Navigation Bar
    if (navAuthLabel) {
      if (currentId) {
        navAuthLabel.innerHTML = '<strong>' + currentId + '</strong> <span class="nav-bal">(' + formattedBalance + 'đ)</span>';
      } else {
        navAuthLabel.textContent = 'Đăng Nhập';
      }
    }

    // 2. Cập nhật Duck User Bar
    if (currentId) {
      if (duckUserGuestWrap) duckUserGuestWrap.classList.add('hidden');
      if (duckUserLoggedWrap) duckUserLoggedWrap.classList.remove('hidden');
      if (duckCurrentIdText) duckCurrentIdText.textContent = currentId;
      if (duckUserBalanceText) duckUserBalanceText.textContent = formattedBalance + ' VNĐ';
    } else {
      if (duckUserGuestWrap) duckUserGuestWrap.classList.remove('hidden');
      if (duckUserLoggedWrap) duckUserLoggedWrap.classList.add('hidden');
    }

    // 3. Cập nhật Auth Modal Status Box
    if (authActiveUserBox) {
      if (currentId) {
        authActiveUserBox.classList.remove('hidden');
        if (authActiveUserText) authActiveUserText.textContent = currentId;
        if (authActiveUserBal) authActiveUserBal.textContent = formattedBalance + ' VNĐ';
      } else {
        authActiveUserBox.classList.add('hidden');
      }
    }

    // 4. Cập nhật Deposit Modal Target ID & Memo nếu đang mở
    const duckDepositTargetId = document.getElementById('duckDepositTargetId');
    const bankMemoText = document.getElementById('bankMemoText');
    if (duckDepositTargetId) duckDepositTargetId.textContent = currentId || 'LXG_PLAYER';
    if (bankMemoText) bankMemoText.textContent = 'NAP ' + (currentId || 'LXG_PLAYER');
    updateZaloDepositPreview();
  }

  function openAuthModal() {
    if (authModal) {
      authModal.classList.remove('hidden');
      if (authModalGameIdInput) {
        authModalGameIdInput.value = '';
        setTimeout(() => authModalGameIdInput.focus(), 150);
      }
    }
  }

  function closeAuthModal() {
    if (authModal) {
      authModal.classList.add('hidden');
    }
  }

  if (btnCloseAuthModal) {
    btnCloseAuthModal.addEventListener('click', closeAuthModal);
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        closeAuthModal();
      }
    });
  }

  if (btnHeaderAuth) {
    btnHeaderAuth.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal();
    });
  }

  if (btnGuestOpenAuth) {
    btnGuestOpenAuth.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal();
    });
  }

  if (btnDuckChangeId) {
    btnDuckChangeId.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal();
    });
  }

  if (btnAuthConfirm && authModalGameIdInput) {
    const handleAuthSubmit = () => {
      const val = authModalGameIdInput.value.trim();
      if (!val) {
        showToast('⚠️ Vui lòng nhập ID Game / Biệt danh của bạn!');
        authModalGameIdInput.focus();
        return;
      }
      registerLxgUser(val);
      closeAuthModal();
      showToast('🎉 Đăng nhập ID Game: ' + val + ' thành công! Đã đồng bộ số dư.');
    };

    btnAuthConfirm.addEventListener('click', handleAuthSubmit);
    authModalGameIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAuthSubmit();
      }
    });
  }

  if (btnAuthLogout) {
    btnAuthLogout.addEventListener('click', () => {
      logoutLxgUser();
      closeAuthModal();
    });
  }

  // Đồng bộ storage khi Admin nạp/trừ tiền hoặc sửa ID ở tab khác
  window.addEventListener('storage', (e) => {
    if (e.key === 'lxg_users' || e.key === 'lxg_current_id') {
      renderAuthAndUserUI();
    }
  });


  // --- 12.3 MODAL NẠP TIỀN VÍ & ZALO ADMIN ---
  const duckDepositModal = document.getElementById('duckDepositModal');
  const btnCloseDuckDeposit = document.getElementById('btnCloseDuckDeposit');
  const btnCopyBankAcc = document.getElementById('btnCopyBankAcc');
  const btnCopyBankMemo = document.getElementById('btnCopyBankMemo');
  const depositChipBtns = document.querySelectorAll('#depositChipsGrid .deposit-chip-btn');
  const btnConfirmZaloDeposit = document.getElementById('btnConfirmZaloDeposit');
  const zaloDepositMsgPreview = document.getElementById('zaloDepositMsgPreview');

  let selectedDepositAmount = 50000;
  let selectedDepositLabel = '50k';

  function updateZaloDepositPreview() {
    const currentId = getLxgCurrentId() || 'LXG_PLAYER';
    const msg = 'Nạp tiền vào ID Game: ' + currentId + ' - Số tiền: ' + selectedDepositLabel;
    if (zaloDepositMsgPreview) {
      zaloDepositMsgPreview.textContent = msg;
    }
  }

  function openDepositModal(suggestedAmount) {
    // Nếu chưa đăng nhập, mở Auth modal trước
    const currentId = getLxgCurrentId();
    if (!currentId) {
      showToast('⚠️ Vui lòng đăng nhập ID Game trước khi nạp tiền!');
      openAuthModal();
      return;
    }

    if (duckDepositModal) {
      duckDepositModal.classList.remove('hidden');
      if (suggestedAmount) {
        depositChipBtns.forEach(btn => {
          if (parseInt(btn.dataset.amount, 10) === suggestedAmount) {
            btn.click();
          }
        });
      }
      updateZaloDepositPreview();
    }
  }

  function closeDepositModal() {
    if (duckDepositModal) {
      duckDepositModal.classList.add('hidden');
    }
  }

  if (btnDuckOpenDeposit) {
    btnDuckOpenDeposit.addEventListener('click', () => openDepositModal(50000));
  }

  if (btnCloseDuckDeposit) {
    btnCloseDuckDeposit.addEventListener('click', closeDepositModal);
  }

  if (duckDepositModal) {
    duckDepositModal.addEventListener('click', (e) => {
      if (e.target === duckDepositModal) {
        closeDepositModal();
      }
    });
  }

  depositChipBtns.forEach(chip => {
    chip.addEventListener('click', () => {
      depositChipBtns.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedDepositAmount = parseInt(chip.dataset.amount, 10) || 50000;
      selectedDepositLabel = chip.dataset.label || (selectedDepositAmount / 1000 + 'k');
      updateZaloDepositPreview();
    });
  });

  if (btnCopyBankAcc) {
    btnCopyBankAcc.addEventListener('click', () => {
      navigator.clipboard.writeText('0702774507').then(() => {
        showToast('📋 Đã sao chép STK VPBank: 0702774507!');
      }).catch(() => {
        showToast('📋 STK VPBank: 0702774507');
      });
    });
  }

  if (btnCopyBankMemo) {
    btnCopyBankMemo.addEventListener('click', () => {
      const currentId = getLxgCurrentId() || 'LXG_PLAYER';
      const memo = 'NAP ' + currentId;
      navigator.clipboard.writeText(memo).then(() => {
        showToast('📋 Đã sao chép nội dung CK: ' + memo);
      }).catch(() => {
        showToast('📋 Nội dung CK: ' + memo);
      });
    });
  }

  if (btnConfirmZaloDeposit) {
    btnConfirmZaloDeposit.addEventListener('click', (e) => {
      e.preventDefault();
      const currentId = getLxgCurrentId() || 'LXG_PLAYER';
      const syntax = 'Nạp tiền vào ID Game: ' + currentId + ' - Số tiền: ' + selectedDepositLabel;

      navigator.clipboard.writeText(syntax).then(() => {
        showToast('📋 Đã sao chép cú pháp nạp tiền! Đang mở Zalo Admin...');
      }).catch(() => {});

      setTimeout(() => {
        window.open('https://zalo.me/0702774507', '_blank');
      }, 300);
    });
  }


  // --- 12.4 MỞ / THU GỌN KHU ĐUA VỊT CHI TIẾT ---
  const duckIntroShowcase = document.getElementById('duckIntroShowcase');
  const duckDetailedArena = document.getElementById('duckDetailedArena');
  const btnOpenDuckArena = document.getElementById('btnOpenDuckArena');
  const btnCloseDuckArena = document.getElementById('btnCloseDuckArena');
  const btnHeaderMinigame = document.querySelector('.btn-header-minigame');

  if (btnOpenDuckArena && duckIntroShowcase && duckDetailedArena) {
    btnOpenDuckArena.addEventListener('click', () => {
      duckIntroShowcase.classList.add('hidden');
      duckDetailedArena.classList.remove('hidden');
      duckDetailedArena.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (btnCloseDuckArena && duckIntroShowcase && duckDetailedArena) {
    btnCloseDuckArena.addEventListener('click', () => {
      duckDetailedArena.classList.add('hidden');
      duckIntroShowcase.classList.remove('hidden');
      duckIntroShowcase.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (btnHeaderMinigame && btnOpenDuckArena) {
    btnHeaderMinigame.addEventListener('click', (e) => {
      e.preventDefault();
      if (duckIntroShowcase && !duckIntroShowcase.classList.contains('hidden')) {
        btnOpenDuckArena.click();
      } else if (duckDetailedArena) {
        duckDetailedArena.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }


  // --- 12.5 ĐIỀU KHIỂN ĐẶT CƯỢC & VỊT ĐANG CHỌN ---
  const duckSelectBtns = document.querySelectorAll('#duck5Selector .duck-select-btn');
  const duckSelectedNameText = document.getElementById('duckSelectedNameText');
  const stakeChipBtns = document.querySelectorAll('#duckStakeChipsGrid .stake-chip-btn');
  const duckStakeAmountText = document.getElementById('duckStakeAmountText');
  const duckPotentialWinText = document.getElementById('duckPotentialWinText');
  const duckActionBtnStake = document.getElementById('duckActionBtnStake');
  const btnBetAndRace = document.getElementById('btnBetAndRace');
  const duckBetBtnText = document.getElementById('duckBetBtnText');
  const duckCurrentBetNotice = document.getElementById('duckCurrentBetNotice');

  let currentSelectedDuckNum = 1;
  let currentSelectedDuckName = 'Vịt #1';
  let currentStake = 5000;

  duckSelectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      duckSelectBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentSelectedDuckNum = parseInt(btn.dataset.duckNum, 10) || 1;
      currentSelectedDuckName = btn.dataset.duckName || ('Vịt #' + currentSelectedDuckNum);

      if (duckSelectedNameText) {
        duckSelectedNameText.textContent = currentSelectedDuckName;
      }
      showToast('🎯 Bạn đang chọn: ' + currentSelectedDuckName + ' (Tỷ lệ 1 ăn 5.0)');
    });
  });

  function updateStakeAndPayout(stake) {
    currentStake = stake;
    const formattedStake = formatVND(stake);
    const potentialWin = stake * 5;
    const formattedWin = formatVND(potentialWin);

    if (duckStakeAmountText) duckStakeAmountText.textContent = formattedStake + ' VNĐ';
    if (duckPotentialWinText) duckPotentialWinText.textContent = formattedWin + ' VNĐ';
    if (duckActionBtnStake) duckActionBtnStake.textContent = formattedStake + 'đ';
  }

  stakeChipBtns.forEach(chip => {
    chip.addEventListener('click', () => {
      stakeChipBtns.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const stake = parseInt(chip.dataset.stake, 10) || 5000;
      updateStakeAndPayout(stake);
    });
  });


  // --- 12.6 LUỒNG ĐUA 45 GIÂY TỰ ĐỘNG LIÊN TỤC (DETERMINISTIC CONTINUOUS ENGINE) ---
  const duckPhaseBadge = document.getElementById('duckPhaseBadge');
  const duckCurrentRoundText = document.getElementById('duckCurrentRoundText');
  const duckArenaCountdown = document.getElementById('duckArenaCountdown');
  const duckCountdownLabel = document.getElementById('duckCountdownLabel');
  const duckRaceStateText = document.getElementById('duckRaceStateText');
  const duckWaterTrack = document.getElementById('duckWaterTrack');

  const duckRacerEls = [
    document.getElementById('duckRacer1'),
    document.getElementById('duckRacer2'),
    document.getElementById('duckRacer3'),
    document.getElementById('duckRacer4'),
    document.getElementById('duckRacer5')
  ];
  const duckWinnerOverlay = document.getElementById('duckWinnerOverlay');
  const duckWinnerTitle = document.getElementById('duckWinnerTitle');
  const duckWinnerDesc = document.getElementById('duckWinnerDesc');

  const CYCLE_MS = 45000;
  const BETTING_MS = 25000;
  const RACING_MS = 17000;
  const RESULT_MS = 3000;

  let currentRoundBet = null;
  let lastAnnouncedRoundId = -1;

  function getDeterministicWinner(roundId) {
    const hash = Math.abs((roundId * 1103515245 + 12345) >> 16);
    return hash % 5;
  }

  function getDuckPhysicsParams(roundId, winnerIdx) {
    const params = [];
    for (let i = 0; i < 5; i++) {
      const seed = (roundId * 31 + i * 17) % 1000;
      params.push({
        phase1: (seed % 628) / 100,
        phase2: ((seed * 3) % 628) / 100,
        burstTime: 3 + ((seed * 7) % 60) / 10,
        burstDuration: 3.2,
        burstPower: 0.11 + ((seed % 50) / 1000),
        isWinner: i === winnerIdx
      });
    }
    return params;
  }

  function resetDucksToStart() {
    duckRacerEls.forEach(duck => {
      if (duck) duck.style.left = '70px';
    });
  }

  function startContinuousRaceLoop() {
    setInterval(() => {
      const now = Date.now();
      const roundId = Math.floor(now / CYCLE_MS);
      const offset = now % CYCLE_MS;
      const winnerIndex = getDeterministicWinner(roundId);
      const winnerDuckNum = winnerIndex + 1;
      const winnerDuckName = 'Vịt #' + winnerDuckNum;

      if (duckCurrentRoundText) {
        duckCurrentRoundText.textContent = 'VÒNG #' + roundId;
      }

      if (roundId !== lastAnnouncedRoundId) {
        lastAnnouncedRoundId = roundId;
        resetDucksToStart();
        if (duckWinnerOverlay) duckWinnerOverlay.classList.add('hidden');
        if (currentRoundBet && currentRoundBet.roundId !== roundId) {
          currentRoundBet = null;
          if (duckCurrentBetNotice) duckCurrentBetNotice.classList.add('hidden');
        }
      }

      // 1. GIAI ĐOẠN ĐẶT CƯỢC (0s - 25s)
      if (offset < BETTING_MS) {
        const remainingSec = Math.ceil((BETTING_MS - offset) / 1000);
        const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
        const ss = String(remainingSec % 60).padStart(2, '0');

        if (duckPhaseBadge) {
          duckPhaseBadge.className = 'track-status-pill phase-betting';
          duckPhaseBadge.innerHTML = '<i class="fa-solid fa-circle"></i> ĐANG NHẬN CƯỢC';
        }
        if (duckCountdownLabel) duckCountdownLabel.textContent = 'Đóng cược sau:';
        if (duckArenaCountdown) duckArenaCountdown.textContent = mm + ':' + ss;
        if (duckRaceStateText) {
          duckRaceStateText.textContent = '⏱️ Đang mở cược Vòng #' + roundId + ' (còn ' + remainingSec + 's) • Tỷ lệ 1 ăn 5.0';
        }

        if (btnBetAndRace) {
          if (currentRoundBet && currentRoundBet.roundId === roundId) {
            btnBetAndRace.disabled = true;
            btnBetAndRace.style.opacity = '0.7';
            if (duckBetBtnText) {
              duckBetBtnText.innerHTML = '<i class="fa-solid fa-circle-check"></i> ĐÃ ĐẶT VỊT #' + currentRoundBet.duckNum + ' - CHỜ ĐUA';
            }
          } else {
            btnBetAndRace.disabled = false;
            btnBetAndRace.style.opacity = '1';
            if (duckBetBtnText) {
              duckBetBtnText.innerHTML = '<i class="fa-solid fa-bolt"></i> XÁC NHẬN ĐẶT CƯỢC (' + formatVND(currentStake) + 'đ)';
            }
          }
        }

        duckRacerEls.forEach((duck, idx) => {
          if (duck) {
            const idleWave = Math.sin((now / 600) + idx) * 3;
            duck.style.left = (70 + idleWave) + 'px';
          }
        });
      }

      // 2. GIAI ĐOẠN ĐUA 17s (25s - 42s)
      else if (offset >= BETTING_MS && offset < (BETTING_MS + RACING_MS)) {
        const raceElapsedMs = offset - BETTING_MS;
        const raceRemainingSec = Math.max(0, Math.ceil((RACING_MS - raceElapsedMs) / 1000));
        const mm = String(Math.floor(raceRemainingSec / 60)).padStart(2, '0');
        const ss = String(raceRemainingSec % 60).padStart(2, '0');

        if (duckPhaseBadge) {
          duckPhaseBadge.className = 'track-status-pill phase-racing';
          duckPhaseBadge.innerHTML = '<i class="fa-solid fa-fire"></i> ĐANG ĐUA SIÊU TỐC';
        }
        if (duckCountdownLabel) duckCountdownLabel.textContent = 'Về đích sau:';
        if (duckArenaCountdown) duckArenaCountdown.textContent = mm + ':' + ss;
        if (duckRaceStateText) {
          duckRaceStateText.textContent = '🌊 VÒNG #' + roundId + ' ĐANG BƠI! 5 chú vịt đang rượt đuổi nghẹt thở!';
        }

        if (btnBetAndRace) {
          btnBetAndRace.disabled = true;
          btnBetAndRace.style.opacity = '0.7';
          if (duckBetBtnText) {
            duckBetBtnText.innerHTML = '<i class="fa-solid fa-lock"></i> ĐÃ KHÓA CƯỢC - ĐANG ĐUA';
          }
        }

        const trackWidth = duckWaterTrack ? duckWaterTrack.clientWidth : 600;
        const startX = 70;
        const finishX = Math.max(380, trackWidth - 110);
        const totalDistance = finishX - startX;

        const globalProgress = Math.min(1.0, raceElapsedMs / RACING_MS);
        const duckPhysics = getDuckPhysicsParams(roundId, winnerIndex);

        for (let i = 0; i < 5; i++) {
          const p = duckPhysics[i];
          let progress = globalProgress;

          const wave1 = Math.sin((raceElapsedMs / 1100) + p.phase1) * 0.04;
          const wave2 = Math.cos((raceElapsedMs / 700) + p.phase2) * 0.025;
          progress += wave1 + wave2;

          const sec = raceElapsedMs / 1000;
          if (sec >= p.burstTime && sec <= p.burstTime + p.burstDuration) {
            const burstProgress = (sec - p.burstTime) / p.burstDuration;
            const burstCurve = Math.sin(burstProgress * Math.PI) * p.burstPower;
            progress += burstCurve;
          }

          if (globalProgress > 0.85 && p.isWinner) {
            const finishSurge = (globalProgress - 0.85) / 0.15;
            progress += finishSurge * 0.12;
          }

          if (progress < 0) progress = 0;
          let currentX = startX + progress * totalDistance;
          if (globalProgress >= 0.98 && p.isWinner) {
            currentX = finishX;
          } else if (currentX > finishX) {
            currentX = finishX - 10;
          }

          if (duckRacerEls[i]) {
            duckRacerEls[i].style.left = Math.round(currentX) + 'px';
          }
        }
      }

      // 3. GIAI ĐOẠN KẾT QUẢ & TRẢ THƯỞNG 3s (42s - 45s)
      else {
        const remainingSec = Math.max(0, Math.ceil((CYCLE_MS - offset) / 1000));
        const ss = String(remainingSec).padStart(2, '0');

        if (duckPhaseBadge) {
          duckPhaseBadge.className = 'track-status-pill phase-result';
          duckPhaseBadge.innerHTML = '<i class="fa-solid fa-trophy"></i> KẾT QUẢ';
        }
        if (duckCountdownLabel) duckCountdownLabel.textContent = 'Vòng mới sau:';
        if (duckArenaCountdown) duckArenaCountdown.textContent = '00:' + ss;
        if (duckRaceStateText) {
          duckRaceStateText.textContent = '🏆 VÒNG #' + roundId + ' KẾT THÚC: ' + winnerDuckName + ' VỀ NHẤT!';
        }

        if (duckWinnerTitle) duckWinnerTitle.textContent = winnerDuckName + ' về nhất!';
        if (duckWinnerDesc) duckWinnerDesc.textContent = 'Vòng #' + roundId + ' • Chúc mừng người chơi thắng x5.0!';
        if (duckWinnerOverlay) duckWinnerOverlay.classList.remove('hidden');

        if (currentRoundBet && currentRoundBet.roundId === roundId && !currentRoundBet.paidOut) {
          currentRoundBet.paidOut = true;
          const currentId = getLxgCurrentId();
          if (currentRoundBet.duckNum === winnerDuckNum) {
            const winAmount = currentRoundBet.stake * 5;
            const currentBal = getLxgUserBalance(currentId);
            const newBal = currentBal + winAmount;
            setLxgUserBalance(currentId, newBal);
            renderAuthAndUserUI();
            showToast('🎉 CHÚC MỪNG! ' + winnerDuckName + ' của bạn đã thắng ' + formatVND(winAmount) + ' VNĐ! Tiền đã tự động cộng vào ví!');
          } else {
            showToast('🏁 ' + winnerDuckName + ' vừa về nhất! Vận may sẽ đến ở vòng tiếp theo nhé!');
          }
        }
      }
    }, 100);
  }

  // --- 12.7 XỬ LÝ SỰ KIỆN ĐẶT CƯỢC ---
  if (btnBetAndRace) {
    btnBetAndRace.addEventListener('click', (e) => {
      e.preventDefault();

      // Kiểm tra xem đã đăng nhập ID Game chưa
      const currentId = getLxgCurrentId();
      if (!currentId) {
        showToast('⚠️ Vui lòng đăng nhập ID Game để tham gia đặt cược!');
        openAuthModal();
        return;
      }

      const now = Date.now();
      const roundId = Math.floor(now / CYCLE_MS);
      const offset = now % CYCLE_MS;

      if (offset >= BETTING_MS) {
        showToast('⏳ Vòng #' + roundId + ' đã khóa cược để đua! Vui lòng chờ vòng sau trong giây lát.');
        return;
      }

      if (currentRoundBet && currentRoundBet.roundId === roundId) {
        showToast('ℹ️ Bạn đã đặt cược Vịt #' + currentRoundBet.duckNum + ' ở vòng này rồi!');
        return;
      }

      const balance = getLxgUserBalance(currentId);
      if (balance < currentStake) {
        showToast('⚠️ Số dư ví không đủ (' + formatVND(balance) + 'đ). Vui lòng nạp thêm tiền để cược!');
        openDepositModal(50000);
        return;
      }

      const newBalance = balance - currentStake;
      setLxgUserBalance(currentId, newBalance);
      renderAuthAndUserUI();

      currentRoundBet = {
        roundId: roundId,
        duckNum: currentSelectedDuckNum,
        stake: currentStake,
        paidOut: false
      };

      if (duckCurrentBetNotice) {
        duckCurrentBetNotice.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Bạn đã cược <strong>' + currentSelectedDuckName + ' (' + formatVND(currentStake) + 'đ)</strong> cho Vòng #' + roundId + '. Đang chờ đua!</span>';
        duckCurrentBetNotice.classList.remove('hidden');
      }

      showToast('✅ Đặt cược thành công ' + formatVND(currentStake) + 'đ cho ' + currentSelectedDuckName + ' (Vòng #' + roundId + ')!');
    });
  }

  // Khởi chạy hệ thống Auth & Đua Vịt
  renderAuthAndUserUI();
  startContinuousRaceLoop();
});
