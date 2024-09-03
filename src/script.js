/* eslint-disable max-depth */
/* eslint-disable max-statements */
(function () {
    // dayjsのロケール設定
    dayjs.locale('ja');

    // コース毎の元気コストの設定
    const staminaCost = {
        _2m_live: 15,
        _2m_work: 15,
        _4m_live: 20,
        _4m_work: 20,
        _2p_live: 25,
        _2p_work: 25,
        _6m_live: 25,
        _6m_work: 25,
        _mm_live: 30,
        _mm_work: 30,
    };

    // コース毎の獲得ptの設定
    const points = {
        _2m_live: 35,
        _2m_work: 35 * 0.7,
        _4m_live: 49,
        _4m_work: 49 * 0.7,
        _2p_live: 62,
        _2p_work: 62 * 0.7,
        _6m_live: 64,
        _6m_work: 64 * 0.7,
        _mm_live: 85,
        _mm_work: 85 * 0.7,
    };
    // Object.keys(points).forEach((p) => (points[p] *= 1.2));

    // イベント楽曲の設定
    const consumedItemPerEvent = 180;
    const earnPointPerEvent = 634;
    // const earnPointPerEvent = 537; // 周年
    const bonusPointPerEvent = 3000;

    // ログインボーナスの設定
    const loginBonusPerDay = 540;

    // 入力値の取得
    function getFormValue() {
        const formValue = {};
        const errors = [];

        if ($('#isNow').prop('checked')) {
            $('#datetimeNow').val(dayjs().format('YYYY-MM-DDTHH:mm'));
            formValue.isNow = true;
        }

        function validDateTime(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!dayjs(inputValue).isValid()) {
                errors.push({
                    field: field,
                    message: '日時の入力例は「2017-06-29T15:00」です。',
                });
            } else {
                formValue[field] = inputValue;
                formValue[`${field}Unix`] = dayjs(inputValue).unix();
            }
        }
        validDateTime('datetimeStart');
        validDateTime('datetimeEnd');
        validDateTime('datetimeNow');

        if (formValue.datetimeNowUnix < formValue.datetimeStartUnix) {
            formValue.datetimeNowUnix = formValue.datetimeStartUnix;
            formValue.isFuture = true;
        }
        if (formValue.datetimeNowUnix > formValue.datetimeEndUnix) {
            formValue.datetimeNowUnix = formValue.datetimeEndUnix;
        }

        formValue.endOfTodayUnix = dayjs(formValue.datetimeNow).endOf('d').unix();
        if (formValue.endOfTodayUnix < formValue.datetimeStartUnix) {
            formValue.endOfTodayUnix = formValue.datetimeStartUnix;
        }
        if (formValue.endOfTodayUnix > formValue.datetimeEndUnix) {
            formValue.endOfTodayUnix = formValue.datetimeEndUnix;
        }

        function validSafeInteger(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!Number.isSafeInteger(Number(inputValue))) {
                errors.push({
                    field: field,
                    message: '有効な値ではありません。',
                });
            } else {
                formValue[field] = Number(inputValue);
            }
        }
        validSafeInteger('targetEnd');
        validSafeInteger('stamina');
        validSafeInteger('liveTicket');
        validSafeInteger('myPoint');
        validSafeInteger('myItem');
        validSafeInteger('remainingMission');
        validSafeInteger('itemExchange_1');
        validSafeInteger('itemExchange_2');
        validSafeInteger('remainingBonus');
        validSafeInteger('todayRemainingTimes');

        formValue.workStaminaCost = Number($('[name="workStaminaCost"]:checked').val());
        formValue.staminaCostMultiplier = Number($('[name="staminaCostMultiplier"]:checked').val());
        formValue.ticketCostMultiplier = Number($('#ticketCostMultiplier').val());
        formValue.itemCostMultiplier = Number($('[name="itemCostMultiplier"]:checked').val());

        formValue.missions = $('[name="missions"]:checked')
            .map((i) => {
                return $('[name="missions"]:checked').eq(i).val();
            })
            .get();
        formValue.showCourse = $('[name="showCourse"]:checked')
            .map((i) => {
                return $('[name="showCourse"]:checked').eq(i).val();
            })
            .get();
        formValue.isAutoSave = $('#autoSave').prop('checked');

        formValue.inTable = {};
        formValue.inTable.workStaminaCost = {};
        formValue.inTable.itemCostMultiplier = {};
        Object.keys(staminaCost).forEach((course) => {
            formValue.inTable.workStaminaCost[course] = Number($(`[name="workStaminaCost${course}"]:checked`).val());
            formValue.inTable.itemCostMultiplier[course] = Number($(`[name="itemCostMultiplier${course}"]:checked`).val());
        });

        $('.error').remove();
        if (errors.length) {
            errors.forEach((error) => {
                $(`#${error.field}`).after(`<span class="error">${error.message}</span>`);
            });
            return null;
        }
        return formValue;
    }

    // 目標ポイントを計算
    function calculateTargetPoint(formValue) {
        let diffEnd = formValue.targetEnd - formValue.myPoint;
        if (diffEnd < 0) {
            diffEnd = 0;
        }
        $('#diffEnd').text(`(あと ${diffEnd.toLocaleString()} pt)`);

        $('#labelToday').text(`【${dayjs.unix(formValue.endOfTodayUnix).format('M/D')}の目標】`);

        const targetToday = Math.round(
            (formValue.targetEnd * (formValue.endOfTodayUnix - formValue.datetimeStartUnix)) /
                (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffToday = targetToday - formValue.myPoint;
        if (diffToday < 0) {
            diffToday = 0;
        }
        $('#targetToday').text(`${targetToday.toLocaleString()} pt (あと ${diffToday.toLocaleString()} pt)`);

        $('#labelNow').text(`【${dayjs.unix(formValue.datetimeNowUnix).format('M/D H:mm')}の目標】`);

        const targetNow = Math.round(
            (formValue.targetEnd * (formValue.datetimeNowUnix - formValue.datetimeStartUnix)) /
                (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffNow = targetNow - formValue.myPoint;
        if (diffNow < 0) {
            diffNow = 0;
        }
        $('#targetNow').text(`${targetNow.toLocaleString()} pt (あと ${diffNow.toLocaleString()} pt)`);
    }

    // ログインボーナスを考慮
    function calculateLoginBonus(formValue) {
        let loginBonus = dayjs.unix(formValue.datetimeEndUnix).endOf('d').diff(dayjs.unix(formValue.datetimeNowUnix), 'd') * loginBonusPerDay;
        if (formValue.isFuture) {
            loginBonus += loginBonusPerDay;
        }
        $('#loginBonus').text(`+ ログインボーナス ${loginBonus.toLocaleString()} 個`);
        formValue.loginBonus = loginBonus;

        $('#expectedPoint').text(
            `(アイテム消費後 ${(
                formValue.myPoint +
                earnPointPerEvent * Math.floor((formValue.myItem + loginBonus) / consumedItemPerEvent)
            ).toLocaleString()} pt)`
        );
    }

    // コース毎の計算
    function calculateByCouse(course, formValue, result, minCost) {
        if (formValue.showCourse.length && formValue.showCourse.indexOf(course) === -1) {
            // 表示コースでなければ計算しない
            return;
        }

        const isWork = course.indexOf('work') !== -1;

        let myItem = formValue.myItem + formValue.loginBonus + formValue.itemExchange_2 * 180;
        const missions = formValue.missions.concat();
        let remainingBonus = formValue.remainingBonus + formValue.itemExchange_1;

        let liveTimes = 0;
        let consumedStaminaByWork = 0;
        let consumedStaminaByLive = 0;
        let liveEarnedPoint = 0;
        let eventTimes = 0;
        let consumedItem = 0;
        let eventEarnedPoint = 0;

        let bonusEventTimes = 0;

        // チケットライブで目標達成できるか判定
        function recommendTicketCostMultiplier() {
            let i = 1;
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (
                    formValue.targetEnd <= formValue.myPoint + liveEarnedPoint + eventEarnedPoint + Math.ceil(points[course] * i) &&
                    formValue.remainingMission <= eventTimes
                ) {
                    // チケットライブのみで目標達成
                    return i;
                }
            }
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (
                    formValue.targetEnd <= formValue.myPoint + liveEarnedPoint + eventEarnedPoint + Math.ceil(points[course] * i) &&
                    consumedItemPerEvent <= myItem + Math.ceil(points[course] * i) &&
                    formValue.remainingMission <= eventTimes + 1
                ) {
                    // チケットライブとイベント楽曲で目標達成
                    return i;
                }
            }
            return formValue.ticketCostMultiplier;
        }

        // 通常楽曲回数、イベント楽曲回数を計算
        while (formValue.targetEnd > formValue.myPoint + liveEarnedPoint + eventEarnedPoint || formValue.remainingMission > eventTimes) {
            // 累積ptが最終目標pt以上になるか、イベント楽曲回数がミッション以上になるまで繰り返し
            if (myItem >= consumedItemPerEvent) {
                // アイテムを所持している場合、イベント楽曲
                myItem -= consumedItemPerEvent;
                eventTimes++;
                consumedItem += consumedItemPerEvent;
                eventEarnedPoint += earnPointPerEvent;

                if (!missions.includes('2')) {
                    // ミッション:イベント楽曲を1回達成
                    missions.push('2');
                    myItem += 360;
                }

                if (remainingBonus > 0) {
                    remainingBonus--;
                    bonusEventTimes++;
                    eventEarnedPoint += bonusPointPerEvent;
                }
            } else {
                if (isWork) {
                    // アイテムを所持していない場合、チケットライブ
                    const recommendedTicketCostMultiplier = recommendTicketCostMultiplier();
                    liveTimes += recommendedTicketCostMultiplier;
                    consumedStaminaByWork += staminaCost[course] * recommendedTicketCostMultiplier;
                    liveEarnedPoint += Math.ceil(points[course] * recommendedTicketCostMultiplier);
                    myItem += Math.ceil(points[course] * recommendedTicketCostMultiplier);
                } else {
                    // アイテムを所持していない場合、ライブ
                    liveTimes++;
                    consumedStaminaByLive += staminaCost[course];
                    liveEarnedPoint += Math.ceil(points[course]);
                    myItem += Math.ceil(points[course]);
                }

                if (!missions.includes('1') && liveEarnedPoint >= 180) {
                    // ミッション:アイテムを180個獲得を達成
                    missions.push('1');
                    myItem += 360;
                }
            }
        }

        // ミッション、リクエスト、ボーナスライブを考慮したイベント楽曲回数を計算
        function calculateEventTimesForRemainingMission() {
            const minValue = Math.min(
                Math.floor(eventTimes / 10),
                dayjs.unix(formValue.datetimeEndUnix).endOf('d').diff(dayjs.unix(formValue.datetimeNowUnix), 'd') + formValue.todayRemainingTimes
            );
            const maxTimesOf10 = formValue.itemCostMultiplier >= 10 ? minValue : 0;
            for (let timesOf10 = maxTimesOf10; timesOf10 >= 0; timesOf10--) {
                const maxTimesOf4 = formValue.itemCostMultiplier >= 4 ? Math.floor((eventTimes - timesOf10 * 10) / 4) : 0;
                for (let timesOf4 = maxTimesOf4; timesOf4 >= 0; timesOf4--) {
                    const maxTimesOf2 = formValue.itemCostMultiplier >= 2 ? Math.floor((eventTimes - timesOf10 * 10 - timesOf4 * 4) / 2) : 0;
                    for (let timesOf2 = maxTimesOf2; timesOf2 >= 0; timesOf2--) {
                        const timesOf1 = eventTimes - timesOf10 * 10 - timesOf4 * 4 - timesOf2 * 2;
                        if (
                            timesOf10 + timesOf4 + timesOf2 + timesOf1 >= formValue.remainingMission &&
                            timesOf10 + timesOf4 + timesOf2 + timesOf1 >= bonusEventTimes
                        ) {
                            // 合計がミッション、ボーナスライブ回数以上なら達成可能
                            return {
                                1: timesOf1,
                                2: timesOf2,
                                4: timesOf4,
                                10: timesOf10,
                            };
                        }
                    }
                }
            }
            return {
                1: eventTimes,
                2: 0,
                4: 0,
                10: 0,
            };
        }
        const fixedEventTimes = calculateEventTimesForRemainingMission();

        // お仕事回数の計算
        function calculateWorkTimes() {
            if (!isWork) {
                return {
                    consumedStamina: consumedStaminaByLive + consumedStaminaByWork,
                    20: { 1: 0, 2: 0, 3: 0 },
                    25: { 1: 0, 2: 0, 3: 0 },
                    30: { 1: 0, 2: 0, 3: 0 },
                };
            }
            const workTimes = {
                consumedStamina: Math.ceil(consumedStaminaByWork / formValue.workStaminaCost) * formValue.workStaminaCost,
                20: { 1: 0, 2: 0, 3: 0 },
                25: { 1: 0, 2: 0, 3: 0 },
                30: { 1: 0, 2: 0, 3: 0 },
            };
            workTimes[formValue.workStaminaCost][1] = Math.ceil(consumedStaminaByWork / formValue.workStaminaCost);
            const workStaminaCost = [20, 25, 30].filter((cost) => cost !== formValue.workStaminaCost);

            const maxTimesOfSelected_3 =
                formValue.staminaCostMultiplier >= 3 ? Math.floor(Math.ceil(consumedStaminaByWork / formValue.workStaminaCost) / 3) : 0;
            for (let timesOfSelected_3 = maxTimesOfSelected_3; timesOfSelected_3 >= 0; timesOfSelected_3--) {
                const maxTimesOf0_3 =
                    formValue.staminaCostMultiplier >= 3
                        ? Math.floor(Math.ceil((consumedStaminaByWork - timesOfSelected_3 * 3 * formValue.workStaminaCost) / workStaminaCost[0]) / 3)
                        : 0;
                for (let timesOf0_3 = maxTimesOf0_3; timesOf0_3 >= 0; timesOf0_3--) {
                    const ceiledValue = Math.ceil(
                        (consumedStaminaByWork - timesOfSelected_3 * 3 * formValue.workStaminaCost - timesOf0_3 * 3 * workStaminaCost[0]) /
                            workStaminaCost[1]
                    );
                    const maxTimesOf1_3 = formValue.staminaCostMultiplier >= 3 ? Math.floor(ceiledValue / 3) : 0;
                    for (let timesOf1_3 = maxTimesOf1_3; timesOf1_3 >= 0; timesOf1_3--) {
                        const maxTimesOfSelected_2 = Math.ceil(
                            (consumedStaminaByWork -
                                timesOfSelected_3 * 3 * formValue.workStaminaCost -
                                timesOf0_3 * 3 * workStaminaCost[0] -
                                timesOf1_3 * 3 * workStaminaCost[1]) /
                                formValue.workStaminaCost
                        );
                        for (let timesOfSelected_2 = maxTimesOfSelected_2; timesOfSelected_2 >= 0; timesOfSelected_2--) {
                            const maxTimesOf0_2 = Math.ceil(
                                (consumedStaminaByWork -
                                    timesOfSelected_3 * 3 * formValue.workStaminaCost -
                                    timesOf0_3 * 3 * workStaminaCost[0] -
                                    timesOf1_3 * 3 * workStaminaCost[1] -
                                    timesOfSelected_2 * formValue.workStaminaCost) /
                                    workStaminaCost[0]
                            );
                            for (let timesOf0_2 = maxTimesOf0_2; timesOf0_2 >= 0; timesOf0_2--) {
                                const maxTimesOf1_2 = Math.ceil(
                                    (consumedStaminaByWork -
                                        timesOfSelected_3 * 3 * formValue.workStaminaCost -
                                        timesOf0_3 * 3 * workStaminaCost[0] -
                                        timesOf1_3 * 3 * workStaminaCost[1] -
                                        timesOfSelected_2 * formValue.workStaminaCost -
                                        timesOf0_2 * workStaminaCost[0]) /
                                        workStaminaCost[1]
                                );
                                for (let timesOf1_2 = maxTimesOf1_2; timesOf1_2 >= 0; timesOf1_2--) {
                                    const maxTimesOfSelected_1 = Math.ceil(
                                        (consumedStaminaByWork -
                                            timesOfSelected_3 * 3 * formValue.workStaminaCost -
                                            timesOf0_3 * 3 * workStaminaCost[0] -
                                            timesOf1_3 * 3 * workStaminaCost[1] -
                                            timesOfSelected_2 * 2 * formValue.workStaminaCost -
                                            timesOf0_2 * 2 * workStaminaCost[0] -
                                            timesOf1_2 * 2 * workStaminaCost[1]) /
                                            formValue.workStaminaCost
                                    );
                                    for (let timesOfSelected_1 = maxTimesOfSelected_1; timesOfSelected_1 >= 0; timesOfSelected_1--) {
                                        const maxTimesOf0_1 = Math.ceil(
                                            (consumedStaminaByWork -
                                                timesOfSelected_3 * 3 * formValue.workStaminaCost -
                                                timesOf0_3 * 3 * workStaminaCost[0] -
                                                timesOf1_3 * 3 * workStaminaCost[1] -
                                                timesOfSelected_2 * 2 * formValue.workStaminaCost -
                                                timesOf0_2 * 2 * workStaminaCost[0] -
                                                timesOf1_2 * 2 * workStaminaCost[1] -
                                                timesOfSelected_1 * formValue.workStaminaCost) /
                                                workStaminaCost[0]
                                        );
                                        for (let timesOf0_1 = maxTimesOf0_1; timesOf0_1 >= 0; timesOf0_1--) {
                                            const maxTimesOf1_1 = Math.ceil(
                                                (consumedStaminaByWork -
                                                    timesOfSelected_3 * 3 * formValue.workStaminaCost -
                                                    timesOf0_3 * 3 * workStaminaCost[0] -
                                                    timesOf1_3 * 3 * workStaminaCost[1] -
                                                    timesOfSelected_2 * 2 * formValue.workStaminaCost -
                                                    timesOf0_2 * 2 * workStaminaCost[0] -
                                                    timesOf1_2 * 2 * workStaminaCost[1] -
                                                    timesOfSelected_1 * formValue.workStaminaCost -
                                                    timesOf0_1 * workStaminaCost[0]) /
                                                    workStaminaCost[1]
                                            );
                                            for (let timesOf1_1 = maxTimesOf1_1; timesOf1_1 >= 0; timesOf1_1--) {
                                                const earnedLiveTicket =
                                                    timesOfSelected_3 * 3 * formValue.workStaminaCost +
                                                    timesOf0_3 * 3 * workStaminaCost[0] +
                                                    timesOf1_3 * 3 * workStaminaCost[1] +
                                                    timesOfSelected_2 * 2 * formValue.workStaminaCost +
                                                    timesOf0_2 * 2 * workStaminaCost[0] +
                                                    timesOf1_2 * 2 * workStaminaCost[1] +
                                                    timesOfSelected_1 * formValue.workStaminaCost +
                                                    timesOf0_1 * workStaminaCost[0] +
                                                    timesOf1_1 * workStaminaCost[1];
                                                if (earnedLiveTicket + formValue.liveTicket === consumedStaminaByWork) {
                                                    // チケット枚数が消費枚数と同じなら無駄ゼロ
                                                    workTimes.consumedStamina = earnedLiveTicket;
                                                    workTimes[formValue.workStaminaCost][3] = timesOfSelected_3;
                                                    workTimes[workStaminaCost[0]][3] = timesOf0_3;
                                                    workTimes[workStaminaCost[1]][3] = timesOf1_3;
                                                    workTimes[formValue.workStaminaCost][2] = timesOfSelected_2;
                                                    workTimes[workStaminaCost[0]][2] = timesOf0_2;
                                                    workTimes[workStaminaCost[1]][2] = timesOf1_2;
                                                    workTimes[formValue.workStaminaCost][1] = timesOfSelected_1;
                                                    workTimes[workStaminaCost[0]][1] = timesOf0_1;
                                                    workTimes[workStaminaCost[1]][1] = timesOf1_1;
                                                    return workTimes;
                                                }
                                                if (earnedLiveTicket + formValue.liveTicket < consumedStaminaByWork) {
                                                    // チケット枚数が消費枚数未満なら達成不能
                                                    continue;
                                                }
                                                if (earnedLiveTicket < workTimes.consumedStamina) {
                                                    // チケット枚数が最小なら格納
                                                    workTimes.consumedStamina = earnedLiveTicket;
                                                    workTimes[formValue.workStaminaCost][3] = timesOfSelected_3;
                                                    workTimes[workStaminaCost[0]][3] = timesOf0_3;
                                                    workTimes[workStaminaCost[1]][3] = timesOf1_3;
                                                    workTimes[formValue.workStaminaCost][2] = timesOfSelected_2;
                                                    workTimes[workStaminaCost[0]][2] = timesOf0_2;
                                                    workTimes[workStaminaCost[1]][2] = timesOf1_2;
                                                    workTimes[formValue.workStaminaCost][1] = timesOfSelected_1;
                                                    workTimes[workStaminaCost[0]][1] = timesOf0_1;
                                                    workTimes[workStaminaCost[1]][1] = timesOf1_1;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return workTimes;
        }
        const fixedWorkTimes = calculateWorkTimes();
        const consumedLiveTicket = consumedStaminaByWork;
        const consumedStamina = fixedWorkTimes.consumedStamina;

        // 所要時間の計算
        function calculateRequiredMinutes() {
            // お仕事
            let requiredMinutes =
                0.5 *
                (fixedWorkTimes[20][1] +
                    fixedWorkTimes[25][1] +
                    fixedWorkTimes[30][1] +
                    fixedWorkTimes[20][2] +
                    fixedWorkTimes[25][2] +
                    fixedWorkTimes[30][2] +
                    fixedWorkTimes[20][3] +
                    fixedWorkTimes[25][3] +
                    fixedWorkTimes[30][3]);
            // 通常楽曲
            if (isWork) {
                // チケットライブ
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.ticketCostMultiplier);
            } else {
                // 通常楽曲
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.staminaCostMultiplier);
            }
            // イベント楽曲
            requiredMinutes += 3 * (fixedEventTimes[1] + fixedEventTimes[2] + fixedEventTimes[4] + fixedEventTimes[10]);
            return requiredMinutes;
        }
        const requiredMinutes = calculateRequiredMinutes();

        // 自然回復日時の計算
        const naturalRecoveryUnix = dayjs
            .unix(formValue.datetimeNowUnix)
            .add((consumedStamina - formValue.stamina) * 5, 'm')
            .unix();

        // 要回復元気の計算
        let requiredRecoveryStamina = 0;
        if (naturalRecoveryUnix > formValue.datetimeEndUnix) {
            requiredRecoveryStamina = Math.ceil((naturalRecoveryUnix - formValue.datetimeEndUnix) / 60 / 5);
        }

        // 計算結果を格納
        result[course] = {};
        result[course].workTimes = fixedWorkTimes;

        if (isWork) {
            result[course].liveTimes = Math.floor(liveTimes / formValue.ticketCostMultiplier).toLocaleString();
            if (liveTimes % formValue.ticketCostMultiplier) {
                result[course].liveTimes += `…${liveTimes % formValue.ticketCostMultiplier}`;
            }
        } else {
            result[course].liveTimes = Math.floor(liveTimes / formValue.staminaCostMultiplier).toLocaleString();
            if (liveTimes % formValue.staminaCostMultiplier) {
                result[course].liveTimes += `…${liveTimes % formValue.staminaCostMultiplier}`;
            }
        }

        result[course].consumedStamina = consumedStamina;
        result[course].naturalRecoveryUnix = naturalRecoveryUnix;
        result[course].requiredRecoveryStamina = requiredRecoveryStamina;
        result[course].consumedLiveTicket = consumedLiveTicket;
        result[course].liveEarnedPoint = liveEarnedPoint;

        result[course].eventTimes = fixedEventTimes;
        result[course].consumedItem = consumedItem;
        result[course].eventEarnedPoint = eventEarnedPoint;
        result[course].requiredMinutes = requiredMinutes;

        result[course].requiredTime = '';
        if (Math.floor(result[course].requiredMinutes / 60)) {
            result[course].requiredTime += `${Math.floor(result[course].requiredMinutes / 60)}時間`;
        }
        if (Math.ceil(result[course].requiredMinutes % 60)) {
            result[course].requiredTime += `${Math.ceil(result[course].requiredMinutes % 60)}分`;
        }
        if (!result[course].requiredTime) {
            result[course].requiredTime += '0分';
        }

        // 所要時間、要回復元気の最小値を格納
        if (minCost.requiredMinutes === undefined || minCost.requiredMinutes > result[course].requiredMinutes) {
            minCost.requiredMinutes = result[course].requiredMinutes;
        }
        if (minCost.requiredRecoveryStamina === undefined || minCost.requiredRecoveryStamina > result[course].requiredRecoveryStamina) {
            minCost.requiredRecoveryStamina = result[course].requiredRecoveryStamina;
        }
    }

    // 計算結果の表示
    function showResultByCouse(course, formValue, minResult, minCost) {
        if (formValue.showCourse.length && formValue.showCourse.indexOf(course) === -1) {
            // 表示コースでなければ列を非表示
            $(`.${course}`).hide();
            const level = course.slice(0, 3);
            const colspan = $(`.${level}`).prop('colspan');
            if (colspan > 1) {
                $(`.${level}`).prop('colspan', colspan - 1);
            } else {
                $(`.${level}`).hide();
            }
            return;
        }

        $(`.${course}`).show();

        let workTimesHtml = '';
        [20, 25, 30]
            .filter((cost) => {
                return (
                    minResult[course].workTimes[cost][1] ||
                    minResult[course].workTimes[cost][2] ||
                    minResult[course].workTimes[cost][3] ||
                    cost === formValue.workStaminaCost
                );
            })
            .forEach((cost) => {
                if (workTimesHtml) {
                    workTimesHtml += '<br>';
                }
                let text = Math.floor(minResult[course].workTimes[cost][formValue.staminaCostMultiplier]).toLocaleString();
                if (formValue.staminaCostMultiplier === 2 && minResult[course].workTimes[cost][1]) {
                    text += `…${minResult[course].workTimes[cost][1]}`;
                }
                if (formValue.staminaCostMultiplier === 3 && (minResult[course].workTimes[cost][2] || minResult[course].workTimes[cost][1])) {
                    text += `…${minResult[course].workTimes[cost][2] * 2 + minResult[course].workTimes[cost][1]}`;
                }
                workTimesHtml +=
                    `<label for="workStaminaCost${course}-${cost}">` +
                    `<input type="radio"` +
                    ` name="workStaminaCost${course}"` +
                    ` id="workStaminaCost${course}-${cost}"` +
                    ` value="${cost}" />` +
                    ` [${cost}] ${text}` +
                    `</label>`;
            });

        let eventTimesHtml = '';
        [1, 2, 4, 10]
            .filter((multiplier) => {
                return minResult[course].eventTimes[multiplier] || multiplier === formValue.itemCostMultiplier;
            })
            .forEach((multiplier) => {
                if (eventTimesHtml) {
                    eventTimesHtml += '<br>';
                }
                eventTimesHtml +=
                    `<label for="itemCostMultiplier${course}-${multiplier}">` +
                    `<input type="radio"` +
                    ` name="itemCostMultiplier${course}"` +
                    ` id="itemCostMultiplier${course}-${multiplier}"` +
                    ` value="${multiplier}" />` +
                    ` [×${multiplier}] ${minResult[course].eventTimes[multiplier].toLocaleString()}` +
                    `</label>`;
            });

        function showResultText(field, minValue, unit, isLink) {
            let text = minValue;
            if (isLink) {
                text =
                    `<a href="../event-jewels-calculator/index.html?datetimeStart=${formValue.datetimeStart}&datetimeEnd=${formValue.datetimeEnd}&` +
                    `consumedStamina=${minResult[course].consumedStamina}&stamina=${formValue.stamina}">${minValue}</a>`;
            }
            if (unit) {
                text += ` ${unit}`;
            }
            $(`#${field}${course}`).html(text);
        }
        showResultText('workTimes', workTimesHtml);
        showResultText('liveTimes', minResult[course].liveTimes);
        showResultText('consumedStamina', minResult[course].consumedStamina.toLocaleString(), false, true);
        showResultText('naturalRecoveryAt', dayjs.unix(minResult[course].naturalRecoveryUnix).format('M/D H:mm'));
        showResultText('requiredRecoveryStamina', minResult[course].requiredRecoveryStamina.toLocaleString());
        showResultText('consumedLiveTicket', minResult[course].consumedLiveTicket.toLocaleString(), '枚');
        showResultText('liveEarnedPoint', minResult[course].liveEarnedPoint.toLocaleString(), 'pt');

        showResultText('eventTimes', eventTimesHtml);
        showResultText('consumedItem', minResult[course].consumedItem.toLocaleString(), '個');
        showResultText('eventEarnedPoint', minResult[course].eventEarnedPoint.toLocaleString(), 'pt');

        showResultText('requiredTime', minResult[course].requiredTime);

        // 表中のラジオボタンに初期値セット
        const workStaminaCost =
            [formValue.workStaminaCost, 20, 25, 30].find((cost) => {
                return minResult[course].workTimes[cost][1] || minResult[course].workTimes[cost][2] || minResult[course].workTimes[cost][3];
            }) || formValue.workStaminaCost;
        $(`[name="workStaminaCost${course}"][value="${workStaminaCost}"]`).prop('checked', true);
        const itemCostMultiplier =
            [1, 2, 4, 10].find((multiplier) => {
                if (multiplier === 10) {
                    return formValue.todayRemainingTimes > 0 && minResult[course].eventTimes[multiplier];
                }
                return minResult[course].eventTimes[multiplier];
            }) || formValue.itemCostMultiplier;
        $(`[name="itemCostMultiplier${course}"][value="${itemCostMultiplier}"]`).prop('checked', true);

        // 所要時間、要回復元気の最小値は青文字
        if (formValue.showCourse.length !== 1 && minResult[course].requiredMinutes === minCost.requiredMinutes) {
            $(`#requiredTime${course}`).addClass('info');
        } else {
            $(`#requiredTime${course}`).removeClass('info');
        }
        if (formValue.showCourse.length !== 1 && minResult[course].requiredRecoveryStamina === minCost.requiredRecoveryStamina) {
            $(`#requiredRecoveryStamina${course}`).addClass('info');
        } else {
            $(`#requiredRecoveryStamina${course}`).removeClass('info');
        }

        // 開催期限をオーバーする場合、赤文字
        if (minResult[course].naturalRecoveryUnix > formValue.datetimeEndUnix) {
            $(`#naturalRecoveryAt${course}`).addClass('danger');
        } else {
            $(`#naturalRecoveryAt${course}`).removeClass('danger');
        }
        if (dayjs.unix(formValue.datetimeNowUnix).add(minResult[course].requiredMinutes, 'm').unix() > formValue.datetimeEndUnix) {
            $(`#requiredTime${course}`).addClass('danger');
        } else {
            $(`#requiredTime${course}`).removeClass('danger');
        }
    }

    // シアターの計算
    function calculateTheater(formValue) {
        const minResult = {};
        const minCost = {};

        // 計算
        Object.keys(staminaCost).forEach((course) => {
            calculateByCouse(course, formValue, minResult, minCost);
        });

        // 表示
        $('._2m_header').prop('colspan', 2);
        $('._4m_header').prop('colspan', 2);
        $('._2p_header').prop('colspan', 2);
        $('._6m_header').prop('colspan', 2);
        $('._mm_header').prop('colspan', 2);
        $('._2m_header').show();
        $('._4m_header').show();
        $('._2p_header').show();
        $('._6m_header').show();
        $('._mm_header').show();
        Object.keys(staminaCost).forEach((course) => {
            showResultByCouse(course, formValue, minResult, minCost);
        });
    }

    function save() {
        const datetimeSave = dayjs().format('YYYY/M/D H:mm');

        const saveData = {
            datetimeStart: $('#datetimeStart').val(),
            datetimeEnd: $('#datetimeEnd').val(),
            targetEnd: $('#targetEnd').val(),
            datetimeNow: $('#datetimeNow').val(),
            isNow: $('#isNow').prop('checked'),
            stamina: $('#stamina').val(),
            liveTicket: $('#liveTicket').val(),
            myPoint: $('#myPoint').val(),
            myItem: $('#myItem').val(),
            remainingMission: $('#remainingMission').val(),
            missions: $('[name="missions"]:checked')
                .map((i) => {
                    return $('[name="missions"]:checked').eq(i).val();
                })
                .get(),
            itemExchange_1: $('#itemExchange_1').val(),
            itemExchange_2: $('#itemExchange_2').val(),
            remainingBonus: $('#remainingBonus').val(),
            workStaminaCost: $('[name="workStaminaCost"]:checked').val(),
            staminaCostMultiplier: $('[name="staminaCostMultiplier"]:checked').val(),
            ticketCostMultiplier: $('#ticketCostMultiplier').val(),
            itemCostMultiplier: $('[name="itemCostMultiplier"]:checked').val(),
            todayRemainingTimes: $('#todayRemainingTimes').val(),
            showCourse: $('[name="showCourse"]:checked')
                .map((i) => {
                    return $('[name="showCourse"]:checked').eq(i).val();
                })
                .get(),
            autoSave: $('#autoSave').prop('checked'),
            datetimeSave: datetimeSave,
        };

        localStorage.setItem(location.href, JSON.stringify(saveData));

        $('#datetimeSave').text(datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);
    }

    function calculate() {
        const formValue = getFormValue();
        calculateTargetPoint(formValue);
        calculateLoginBonus(formValue);
        calculateTheater(formValue);
        if (formValue.isAutoSave) {
            save();
        }
    }

    // input要素の変更時
    $('#datetimeStart').change(calculate);
    $('#datetimeEnd').change(calculate);
    $('#targetEnd').change(calculate);
    $('#datetimeNow').change(() => {
        $('#isNow').prop('checked', true);
        if ($('#datetimeNow').val() !== dayjs().format('YYYY-MM-DDTHH:mm')) {
            $('#isNow').prop('checked', false);
        }
        calculate();
    });
    $('#isNow').change(calculate);
    $('#stamina').change(calculate);
    $('#liveTicket').change(calculate);
    $('#myItem').change(calculate);
    $('#myPoint').change(calculate);
    $('#remainingMission').change(calculate);
    $('[name="missions"]').change(calculate);
    $('#itemExchange_1').change(calculate);
    $('#itemExchange_2').change(calculate);
    $('#remainingBonus').change(calculate);
    $('[name="workStaminaCost"]').change(calculate);
    $('[name="staminaCostMultiplier"]').change(calculate);
    $('#ticketCostMultiplier').change(calculate);
    $('[name="itemCostMultiplier"]').change(calculate);
    $('#todayRemainingTimes').change(calculate);
    $('[name="showCourse"]').change(() => {
        $('#showCourse-all').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (!$('[name="showCourse"]').eq(i).prop('checked')) {
                $('#showCourse-all').prop('checked', false);
            }
        });
        calculate();
    });
    $('#showCourse-all').change(() => {
        $('[name="showCourse"]').each((i) => {
            $('[name="showCourse"]').eq(i).prop('checked', $('#showCourse-all').prop('checked'));
        });
        calculate();
    });
    $('#update').click(calculate);
    $('#autoSave').change(calculate);

    // 回数増減ボタン
    $('.beforeExchangeItem_1').click(() => {
        const formValue = getFormValue();

        $('#itemExchange_1').val(formValue.itemExchange_1 + 1);
        $('#remainingBonus').val(formValue.remainingBonus - 1);

        calculate();
    });
    $('.afterExchangeItem_1').click(() => {
        const formValue = getFormValue();

        $('#itemExchange_1').val(formValue.itemExchange_1 - 1);
        $('#remainingBonus').val(formValue.remainingBonus + 1);

        calculate();
    });
    $('.beforeExchangeItem_2').click(() => {
        const formValue = getFormValue();

        $('#itemExchange_2').val(formValue.itemExchange_2 + 1);
        $('#myItem').val(formValue.myItem - 180);

        calculate();
    });
    $('.afterExchangeItem_2').click(() => {
        const formValue = getFormValue();

        $('#itemExchange_2').val(formValue.itemExchange_2 - 1);
        $('#myItem').val(formValue.myItem + 180);

        calculate();
    });
    $('.beforePlayWork').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTicket').val(formValue.liveTicket - formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);

        $('#stamina').val(formValue.stamina + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.afterPlayWork').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        formValue.liveTicket += formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier;
        if (formValue.liveTicket > 900) {
            if (confirm(`ライブチケットが${formValue.liveTicket - 900}枚超過します。\n超過分は加算されません。\n実行しますか？`)) {
                formValue.liveTicket = 900;
            } else {
                return;
            }
        }
        $('#liveTicket').val(formValue.liveTicket);

        $('#stamina').val(formValue.stamina - formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.beforePlayTicketLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTicket').val(formValue.liveTicket + staminaCost[course] * formValue.ticketCostMultiplier);
        $('#myPoint').val(formValue.myPoint - Math.ceil(points[course] * formValue.ticketCostMultiplier));

        $('#myItem').val(formValue.myItem - Math.ceil(points[course] * formValue.ticketCostMultiplier));

        calculate();
    });
    $('.afterPlayTicketLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTicket').val(formValue.liveTicket - staminaCost[course] * formValue.ticketCostMultiplier);
        $('#myPoint').val(formValue.myPoint + Math.ceil(points[course] * formValue.ticketCostMultiplier));

        formValue.myItem += Math.ceil(points[course] * formValue.ticketCostMultiplier);
        const loginBonus =
            (dayjs.unix(formValue.datetimeNowUnix).endOf('d').diff(dayjs.unix(formValue.datetimeStartUnix), 'd') + 1) * loginBonusPerDay;
        if (!formValue.missions.includes('1') && formValue.myItem - loginBonus >= 180) {
            // ミッション:アイテムを180個獲得を達成
            $(`[name="missions"][value="1"]`).prop('checked', true);
            formValue.myItem += 360;
        }
        $('#myItem').val(formValue.myItem);

        calculate();
    });
    $('.beforePlayLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina + staminaCost[course] * formValue.staminaCostMultiplier);
        $('#myPoint').val(formValue.myPoint - points[course] * formValue.staminaCostMultiplier);

        $('#myItem').val(formValue.myItem - points[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.afterPlayLive').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina - staminaCost[course] * formValue.staminaCostMultiplier);
        $('#myPoint').val(formValue.myPoint + points[course] * formValue.staminaCostMultiplier);

        formValue.myItem += points[course] * formValue.staminaCostMultiplier;
        const loginBonus =
            (dayjs.unix(formValue.datetimeNowUnix).endOf('d').diff(dayjs.unix(formValue.datetimeStartUnix), 'd') + 1) * loginBonusPerDay;
        if (!formValue.missions.includes('1') && formValue.myItem - loginBonus >= 180) {
            // ミッション:アイテムを180個獲得を達成
            $(`[name="missions"][value="1"]`).prop('checked', true);
            formValue.myItem += 360;
        }
        $('#myItem').val(formValue.myItem);

        calculate();
    });
    $('.beforePlayEvent').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#myItem').val(formValue.myItem + consumedItemPerEvent * formValue.inTable.itemCostMultiplier[course]);

        $('#myPoint').val(formValue.myPoint - earnPointPerEvent * formValue.inTable.itemCostMultiplier[course]);

        $('#remainingMission').val(formValue.remainingMission + 1);
        if (formValue.inTable.itemCostMultiplier[course] === 10) {
            $('#todayRemainingTimes').val(formValue.todayRemainingTimes + 1);
        }

        calculate();
    });
    $('.afterPlayEvent').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        formValue.myItem -= consumedItemPerEvent * formValue.inTable.itemCostMultiplier[course];
        if (!formValue.missions.includes('2')) {
            // ミッション:イベント楽曲を1回達成
            $(`[name="missions"][value="2"]`).prop('checked', true);
            formValue.myItem += 360;
        }
        $('#myItem').val(formValue.myItem);

        formValue.myPoint += earnPointPerEvent * formValue.inTable.itemCostMultiplier[course];
        if (formValue.remainingBonus > 0) {
            $('#remainingBonus').val(formValue.remainingBonus - 1);
            formValue.myPoint += bonusPointPerEvent;
        }
        $('#myPoint').val(formValue.myPoint);

        $('#remainingMission').val(formValue.remainingMission - 1);
        if (formValue.inTable.itemCostMultiplier[course] === 10) {
            $('#todayRemainingTimes').val(formValue.todayRemainingTimes - 1);
        }

        calculate();
    });

    // 保存ボタン
    $('#save').click(save);

    // 入力を初期化ボタン
    function defaultInput() {
        $('#datetimeStart').val(dayjs().subtract(15, 'h').format('YYYY-MM-DDT15:00'));
        $('#datetimeEnd').val(dayjs().subtract(15, 'h').add(1, 'w').format('YYYY-MM-DDT20:59'));
        $('#targetEnd').val(30000);
        $('#datetimeNow').val(dayjs().format('YYYY-MM-DDTHH:mm'));
        $('#isNow').prop('checked', true);
        $('#stamina').val(0);
        $('#liveTicket').val(0);
        $('#myPoint').val(0);
        $('#myItem').val(0);
        $('#remainingMission').val(30);
        $('[name="missions"]').each((i) => {
            $('[name="missions"]').eq(i).prop('checked', false);
        });
        $('#itemExchange_1').val(5);
        $('#itemExchange_2').val(20);
        $('#remainingBonus').val(0);
        $('[name="workStaminaCost"][value="20"]').prop('checked', true);
        $('[name="staminaCostMultiplier"][value="1"]').prop('checked', true);
        $('#ticketCostMultiplier').val(10);
        $('[name="itemCostMultiplier"][value="1"]').prop('checked', true);
        $('#todayRemainingTimes').val(1);
        $('[name="showCourse"]').each((i) => {
            if (
                ['_2m_live', '_2m_work', '_4m_live', '_4m_work', '_2p_live', '_2p_work', '_6m_live', '_6m_work', '_mm_live', '_mm_work'].indexOf(
                    $('[name="showCourse"]').eq(i).val()
                ) !== -1
            ) {
                $('[name="showCourse"]').eq(i).prop('checked', true);
            } else {
                $('[name="showCourse"]').eq(i).prop('checked', false);
            }
        });
        $('#showCourse-all').prop('checked', true);
        $('#autoSave').prop('checked', false);

        calculate();
    }
    $('#clearInput').click(defaultInput);

    // 保存した値を読込ボタン
    function loadSavedData() {
        const savedString = localStorage.getItem(location.href);

        if (!savedString) {
            return false;
        }

        const savedData = JSON.parse(savedString);

        $('#datetimeStart').val(savedData.datetimeStart);
        $('#datetimeEnd').val(savedData.datetimeEnd);
        $('#targetEnd').val(savedData.targetEnd);
        $('#datetimeNow').val(savedData.datetimeNow);
        $('#isNow').prop('checked', savedData.isNow);
        $('#stamina').val(savedData.stamina);
        $('#liveTicket').val(savedData.liveTicket);
        $('#myPoint').val(savedData.myPoint);
        $('#myItem').val(savedData.myItem);
        $('#remainingMission').val(savedData.remainingMission);
        $('[name="missions"]').each((i) => {
            if (savedData.missions.indexOf($('[name="missions"]').eq(i).val()) !== -1) {
                $('[name="missions"]').eq(i).prop('checked', true);
            } else {
                $('[name="missions"]').eq(i).prop('checked', false);
            }
        });
        $('#itemExchange_1').val(savedData.itemExchange_1);
        $('#itemExchange_2').val(savedData.itemExchange_2);
        $('#remainingBonus').val(savedData.remainingBonus);
        $(`[name="workStaminaCost"][value="${savedData.workStaminaCost}"]`).prop('checked', true);
        $(`[name="staminaCostMultiplier"][value="${savedData.staminaCostMultiplier}"]`).prop('checked', true);
        $('#ticketCostMultiplier').val(savedData.ticketCostMultiplier);
        $(`[name="itemCostMultiplier"][value="${savedData.itemCostMultiplier}"]`).prop('checked', true);
        $('#todayRemainingTimes').val(savedData.todayRemainingTimes);
        $('#showCourse-all').prop('checked', true);
        $('[name="showCourse"]').each((i) => {
            if (savedData.showCourse.indexOf($('[name="showCourse"]').eq(i).val()) !== -1) {
                $('[name="showCourse"]').eq(i).prop('checked', true);
            } else {
                $('[name="showCourse"]').eq(i).prop('checked', false);
                $('#showCourse-all').prop('checked', false);
            }
        });
        $('#autoSave').prop('checked', savedData.autoSave);

        calculate();

        $('#datetimeSave').text(savedData.datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);

        return true;
    }
    $('#loadSave').click(loadSavedData);

    // 保存した値を削除ボタン
    $('#clearSave').click(() => {
        localStorage.removeItem(location.href);

        $('#datetimeSave').text('削除済');
        $('#loadSave').prop('disabled', true);
        $('#clearSave').prop('disabled', true);
    });

    // 画面表示時に保存した値を読込、保存した値がなければ入力の初期化
    if (!loadSavedData()) {
        defaultInput();
    }
})();
