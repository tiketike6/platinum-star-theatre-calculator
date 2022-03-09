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

    // イベント楽曲の設定
    const consumedItemsPerEvent = 180;
    const earnPointsPerEvent = 537;

    // 入力値の取得
    function getFormValue() {
        const formValue = {};
        const errors = [];

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

        formValue.endOfTodayUnix = dayjs().endOf('d').unix();
        if (formValue.endOfTodayUnix < formValue.datetimeStartUnix) {
            formValue.endOfTodayUnix = formValue.datetimeStartUnix;
        }
        if (formValue.endOfTodayUnix > formValue.datetimeEndUnix) {
            formValue.endOfTodayUnix = formValue.datetimeEndUnix;
        }

        formValue.nowUnix = dayjs().endOf('m').unix();
        if (formValue.nowUnix < formValue.datetimeStartUnix) {
            formValue.nowUnix = formValue.datetimeStartUnix;
            formValue.isFuture = true;
        }
        if (formValue.nowUnix > formValue.datetimeEndUnix) {
            formValue.nowUnix = formValue.datetimeEndUnix;
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
        validSafeInteger('liveTickets');
        validSafeInteger('ownPoints');
        validSafeInteger('ownItems');
        validSafeInteger('mission');

        formValue.workStaminaCost = Number($('[name="workStaminaCost"]:checked').val());
        formValue.staminaCostMultiplier = Number($('[name="staminaCostMultiplier"]:checked').val());
        formValue.ticketCostMultiplier = Number($('#ticketCostMultiplier').val());
        formValue.itemsCostMultiplier = Number($('[name="itemsCostMultiplier"]:checked').val());
        formValue.showCourse = $('[name="showCourse"]:checked')
            .map((i) => {
                return $('[name="showCourse"]:checked').eq(i).val();
            })
            .get();
        formValue.isAutoSave = $('#autoSave').prop('checked');
        formValue.inTable = {};
        formValue.inTable.workStaminaCost = {};
        formValue.inTable.itemsCostMultiplier = {};
        Object.keys(staminaCost).forEach((course) => {
            formValue.inTable.workStaminaCost[course] = Number($(`[name="workStaminaCost${course}"]:checked`).val());
            formValue.inTable.itemsCostMultiplier[course] = Number($(`[name="itemsCostMultiplier${course}"]:checked`).val());
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
        let diffEnd = formValue.targetEnd - formValue.ownPoints;
        if (diffEnd < 0) {
            diffEnd = 0;
        }
        $('#diffEnd').text(`(あと ${diffEnd.toLocaleString()} pt)`);

        $('#labelToday').text(`${dayjs.unix(formValue.endOfTodayUnix).format('M/D')}の目標pt`);

        const targetToday = Math.round(
            (formValue.targetEnd * (formValue.endOfTodayUnix - formValue.datetimeStartUnix)) /
                (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffToday = targetToday - formValue.ownPoints;
        if (diffToday < 0) {
            diffToday = 0;
        }
        $('#targetToday').text(`${targetToday.toLocaleString()} pt (あと ${diffToday.toLocaleString()} pt)`);

        $('#labelNow').text(`${dayjs.unix(formValue.nowUnix).format('M/D H:mm')}の目標pt`);

        const targetNow = Math.round(
            (formValue.targetEnd * (formValue.nowUnix - formValue.datetimeStartUnix)) / (formValue.datetimeEndUnix - formValue.datetimeStartUnix)
        );
        let diffNow = targetNow - formValue.ownPoints;
        if (diffNow < 0) {
            diffNow = 0;
        }
        $('#targetNow').text(`${targetNow.toLocaleString()} pt (あと ${diffNow.toLocaleString()} pt)`);
    }

    // ログインボーナスを考慮
    function calculateLoginBonus(formValue) {
        const loginBonusPerDay = 360;
        let loginBonus = dayjs.unix(formValue.datetimeEndUnix).endOf('d').diff(dayjs.unix(formValue.nowUnix), 'd') * loginBonusPerDay;
        if (formValue.isFuture) {
            loginBonus += loginBonusPerDay;
        }
        $('#loginBonus').text(`+ ログインボーナス ${loginBonus.toLocaleString()} 個`);
        formValue.loginBonus = loginBonus;

        $('#expectedPoints').text(
            `(アイテム消費後 ${(
                formValue.ownPoints +
                earnPointsPerEvent * Math.floor((formValue.ownItems + loginBonus) / consumedItemsPerEvent)
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

        let ownItems = formValue.ownItems + formValue.loginBonus;

        let liveTimes = 0;
        let consumedStamina = 0;
        let liveEarnedPoints = 0;
        let eventTimes = 0;
        let consumedItems = 0;
        let eventEarnedPoints = 0;

        // チケットライブで目標達成できるか判定
        function recommendTicketCostMultiplier() {
            let i = 1;
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (
                    formValue.targetEnd <= formValue.ownPoints + liveEarnedPoints + eventEarnedPoints + Math.ceil(points[course] * i) &&
                    formValue.mission <= eventTimes
                ) {
                    // チケットライブのみで目標達成
                    return i;
                }
            }
            for (i = 1; i <= formValue.ticketCostMultiplier; i++) {
                if (
                    formValue.targetEnd <= formValue.ownPoints + liveEarnedPoints + eventEarnedPoints + Math.ceil(points[course] * i) &&
                    consumedItemsPerEvent <= ownItems + Math.ceil(points[course] * i) &&
                    formValue.mission <= eventTimes + 1
                ) {
                    // チケットライブとイベント楽曲で目標達成
                    return i;
                }
            }
            return formValue.ticketCostMultiplier;
        }

        // 通常楽曲回数、イベント楽曲回数を計算
        while (formValue.targetEnd > formValue.ownPoints + liveEarnedPoints + eventEarnedPoints || formValue.mission > eventTimes) {
            // 累積ptが最終目標pt以上になるか、イベント楽曲回数がミッション以上になるまで繰り返し
            if (ownItems >= consumedItemsPerEvent) {
                // アイテムを所持している場合、イベント楽曲
                ownItems -= consumedItemsPerEvent;
                eventTimes++;
                consumedItems += consumedItemsPerEvent;
                eventEarnedPoints += earnPointsPerEvent;
            } else if (isWork) {
                // アイテムを所持していない場合、チケットライブ
                const recommendedTicketCostMultiplier = recommendTicketCostMultiplier();
                liveTimes += recommendedTicketCostMultiplier;
                consumedStamina += staminaCost[course] * recommendedTicketCostMultiplier;
                liveEarnedPoints += Math.ceil(points[course] * recommendedTicketCostMultiplier);
                ownItems += Math.ceil(points[course] * recommendedTicketCostMultiplier);
            } else {
                // アイテムを所持していない場合、ライブ
                liveTimes++;
                consumedStamina += staminaCost[course];
                liveEarnedPoints += Math.ceil(points[course]);
                ownItems += Math.ceil(points[course]);
            }
        }

        // ミッションを考慮したイベント楽曲回数を計算
        function calculateEventTimesForMission() {
            const maxTimesOf4 = formValue.itemsCostMultiplier >= 4 ? Math.floor(eventTimes / 4) : 0;
            for (let timesOf4 = maxTimesOf4; timesOf4 >= 0; timesOf4--) {
                const maxTimesOf2 = formValue.itemsCostMultiplier >= 2 ? Math.floor((eventTimes - timesOf4 * 4) / 2) : 0;
                for (let timesOf2 = maxTimesOf2; timesOf2 >= 0; timesOf2--) {
                    const timesOf1 = eventTimes - timesOf4 * 4 - timesOf2 * 2;
                    if (timesOf4 + timesOf2 + timesOf1 >= formValue.mission) {
                        // 合計がミッション回数以上なら達成可能
                        return {
                            1: timesOf1,
                            2: timesOf2,
                            4: timesOf4,
                        };
                    }
                }
            }
            return {
                1: eventTimes,
                2: 0,
                4: 0,
            };
        }
        const fixedEventTimes = calculateEventTimesForMission();

        // お仕事回数の計算
        function calculateWorkTimes() {
            if (!isWork) {
                return {
                    consumedStamina: consumedStamina,
                    20: 0,
                    25: 0,
                    30: 0,
                };
            }
            const workTimes = {
                consumedStamina: Math.ceil(consumedStamina / formValue.workStaminaCost) * formValue.workStaminaCost,
                20: 0,
                25: 0,
                30: 0,
            };
            workTimes[formValue.workStaminaCost] = Math.ceil(consumedStamina / formValue.workStaminaCost);
            const workStaminaCost = [20, 25, 30].filter((cost) => cost !== formValue.workStaminaCost);
            const maxTimesOfSelected = Math.ceil(consumedStamina / formValue.workStaminaCost);
            for (let timesOfSelected = maxTimesOfSelected; timesOfSelected >= 0; timesOfSelected--) {
                const maxTimesOf0 = Math.ceil((consumedStamina - timesOfSelected * formValue.workStaminaCost) / workStaminaCost[0]);
                for (let timesOf0 = maxTimesOf0; timesOf0 >= 0; timesOf0--) {
                    const maxTimesOf1 = Math.ceil(
                        (consumedStamina - timesOfSelected * formValue.workStaminaCost - timesOf0 * workStaminaCost[0]) / workStaminaCost[1]
                    );
                    for (let timesOf1 = maxTimesOf1; timesOf1 >= 0; timesOf1--) {
                        const earnedLiveTickets =
                            timesOfSelected * formValue.workStaminaCost + timesOf0 * workStaminaCost[0] + timesOf1 * workStaminaCost[1];
                        if (earnedLiveTickets + formValue.liveTickets === consumedStamina) {
                            // チケット枚数が消費枚数と同じなら無駄ゼロ
                            workTimes.consumedStamina = earnedLiveTickets;
                            workTimes[formValue.workStaminaCost] = timesOfSelected;
                            workTimes[workStaminaCost[0]] = timesOf0;
                            workTimes[workStaminaCost[1]] = timesOf1;
                            return workTimes;
                        }
                        if (earnedLiveTickets + formValue.liveTickets < consumedStamina) {
                            // チケット枚数が消費枚数未満なら達成不能
                            continue;
                        }
                        if (earnedLiveTickets < workTimes.consumedStamina) {
                            // チケット枚数が最小なら格納
                            workTimes.consumedStamina = earnedLiveTickets;
                            workTimes[formValue.workStaminaCost] = timesOfSelected;
                            workTimes[workStaminaCost[0]] = timesOf0;
                            workTimes[workStaminaCost[1]] = timesOf1;
                        }
                    }
                }
            }
            return workTimes;
        }
        const fixedWorkTimes = calculateWorkTimes(consumedStamina);
        const consumedLiveTickets = consumedStamina;
        consumedStamina = fixedWorkTimes.consumedStamina;

        // 所要時間の計算
        function calculateRequiredMinutes() {
            // お仕事
            let requiredMinutes =
                0.5 *
                (Math.ceil(fixedWorkTimes[20] / formValue.staminaCostMultiplier) +
                    Math.ceil(fixedWorkTimes[25] / formValue.staminaCostMultiplier) +
                    Math.ceil(fixedWorkTimes[30] / formValue.staminaCostMultiplier));
            // 通常楽曲
            if (isWork) {
                // チケットライブ
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.ticketCostMultiplier);
            } else {
                // 通常楽曲
                requiredMinutes += 3 * Math.ceil(liveTimes / formValue.staminaCostMultiplier);
            }
            // イベント楽曲
            requiredMinutes += 3 * (fixedEventTimes[1] + fixedEventTimes[2] + fixedEventTimes[4]);
            return requiredMinutes;
        }
        const requiredMinutes = calculateRequiredMinutes();

        // 自然回復日時の計算
        const naturalRecoveryUnix = dayjs
            .unix(formValue.nowUnix)
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
        result[course].consumedLiveTickets = consumedLiveTickets;
        result[course].liveEarnedPoints = liveEarnedPoints;

        result[course].eventTimes = fixedEventTimes;
        result[course].consumedItems = consumedItems;
        result[course].eventEarnedPoints = eventEarnedPoints;
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

        // 消費元気、所要時間の最小値を格納
        if (minCost.consumedStamina === undefined || minCost.consumedStamina > result[course].consumedStamina) {
            minCost.consumedStamina = result[course].consumedStamina;
        }
        if (minCost.requiredMinutes === undefined || minCost.requiredMinutes > result[course].requiredMinutes) {
            minCost.requiredMinutes = result[course].requiredMinutes;
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
                return minResult[course].workTimes[cost] || cost === formValue.workStaminaCost;
            })
            .forEach((cost) => {
                if (workTimesHtml) {
                    workTimesHtml += '<br>';
                }
                let text = Math.floor(minResult[course].workTimes[cost] / formValue.staminaCostMultiplier).toLocaleString();
                if (minResult[course].workTimes[cost] % formValue.staminaCostMultiplier) {
                    text += `…${minResult[course].workTimes[cost] % formValue.staminaCostMultiplier}`;
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
        [1, 2, 4]
            .filter((multiplier) => {
                return minResult[course].eventTimes[multiplier] || multiplier === formValue.itemsCostMultiplier;
            })
            .forEach((multiplier) => {
                if (eventTimesHtml) {
                    eventTimesHtml += '<br>';
                }
                eventTimesHtml +=
                    `<label for="itemsCostMultiplier${course}-${multiplier}">` +
                    `<input type="radio"` +
                    ` name="itemsCostMultiplier${course}"` +
                    ` id="itemsCostMultiplier${course}-${multiplier}"` +
                    ` value="${multiplier}" />` +
                    ` [×${multiplier}] ${minResult[course].eventTimes[multiplier].toLocaleString()}` +
                    `</label>`;
            });

        function showResultText(field, minValue, unit, isLink) {
            let text = minValue;
            if (isLink) {
                text = `<a href="../event-jewels-calculator/index.html?datetimeStart=${formValue.datetimeStart}&datetimeEnd=${
                    formValue.datetimeEnd
                }&consumedStamina=${minValue}&stamina=${formValue.stamina}">${minValue.toLocaleString()}</a>`;
            }
            if (unit) {
                text += ` ${unit}`;
            }
            $(`#${field}${course}`).html(text);
        }
        showResultText('workTimes', workTimesHtml);
        showResultText('liveTimes', minResult[course].liveTimes);
        showResultText('consumedStamina', minResult[course].consumedStamina.toLocaleString());
        showResultText('naturalRecoveryAt', dayjs.unix(minResult[course].naturalRecoveryUnix).format('M/D H:mm'));
        showResultText('requiredRecoveryStamina', minResult[course].requiredRecoveryStamina.toLocaleString(), false, true);
        showResultText('consumedLiveTickets', minResult[course].consumedLiveTickets.toLocaleString(), '枚');
        showResultText('liveEarnedPoints', minResult[course].liveEarnedPoints.toLocaleString(), 'pt');

        showResultText('eventTimes', eventTimesHtml);
        showResultText('consumedItems', minResult[course].consumedItems.toLocaleString(), '個');
        showResultText('eventEarnedPoints', minResult[course].eventEarnedPoints.toLocaleString(), 'pt');

        showResultText('requiredTime', minResult[course].requiredTime);

        // 表中のラジオボタンに初期値セット
        const workStaminaCost =
            [formValue.workStaminaCost, 20, 25, 30].find((cost) => {
                return minResult[course].workTimes[cost];
            }) || formValue.workStaminaCost;
        $(`[name="workStaminaCost${course}"][value="${workStaminaCost}"]`).prop('checked', true);
        const itemsCostMultiplier =
            [4, 2, 1].find((multiplier) => {
                return minResult[course].eventTimes[multiplier];
            }) || formValue.itemsCostMultiplier;
        $(`[name="itemsCostMultiplier${course}"][value="${itemsCostMultiplier}"]`).prop('checked', true);

        // 消費元気、所要時間の最小値は青文字
        if (formValue.showCourse.length !== 1 && minResult[course].consumedStamina === minCost.consumedStamina) {
            $(`#consumedStamina${course}`).addClass('info');
        } else {
            $(`#consumedStamina${course}`).removeClass('info');
        }
        if (formValue.showCourse.length !== 1 && minResult[course].requiredMinutes === minCost.requiredMinutes) {
            $(`#requiredTime${course}`).addClass('info');
        } else {
            $(`#requiredTime${course}`).removeClass('info');
        }

        // 開催期限をオーバーする場合、赤文字
        if (minResult[course].naturalRecoveryUnix > formValue.datetimeEndUnix) {
            $(`#naturalRecoveryAt${course}`).addClass('danger');
        } else {
            $(`#naturalRecoveryAt${course}`).removeClass('danger');
        }
        if (dayjs.unix(formValue.nowUnix).add(minResult[course].requiredMinutes, 'm').unix() > formValue.datetimeEndUnix) {
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
        $('._2m').prop('colspan', 2);
        $('._4m').prop('colspan', 2);
        $('._2p').prop('colspan', 2);
        $('._6m').prop('colspan', 2);
        $('._mm').prop('colspan', 2);
        $('._2m').show();
        $('._4m').show();
        $('._2p').show();
        $('._6m').show();
        $('._mm').show();
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
            stamina: $('#stamina').val(),
            liveTickets: $('#liveTickets').val(),
            ownPoints: $('#ownPoints').val(),
            ownItems: $('#ownItems').val(),
            mission: $('#mission').val(),
            workStaminaCost: $('[name="workStaminaCost"]:checked').val(),
            staminaCostMultiplier: $('[name="staminaCostMultiplier"]:checked').val(),
            ticketCostMultiplier: $('#ticketCostMultiplier').val(),
            itemsCostMultiplier: $('[name="itemsCostMultiplier"]:checked').val(),
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
    $('#stamina').change(calculate);
    $('#liveTickets').change(calculate);
    $('#ownItems').change(calculate);
    $('#ownPoints').change(calculate);
    $('#mission').change(calculate);
    $('[name="workStaminaCost"]').change(calculate);
    $('[name="staminaCostMultiplier"]').change(calculate);
    $('#ticketCostMultiplier').change(calculate);
    $('[name="itemsCostMultiplier"]').change(calculate);
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
    $('.subtractWorkTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);
        $('#liveTickets').val(formValue.liveTickets - formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.addWorkTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        if (formValue.liveTickets + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier > 500) {
            if (
                confirm(
                    `ライブチケットが${
                        formValue.liveTickets + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier - 500
                    }枚超過します。\n超過分は加算されません。\n実行しますか？`
                )
            ) {
                $('#liveTickets').val(500);
            } else {
                return;
            }
        } else {
            $('#liveTickets').val(formValue.liveTickets + formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);
        }

        $('#stamina').val(formValue.stamina - formValue.inTable.workStaminaCost[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.subtractTicketLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTickets').val(formValue.liveTickets + staminaCost[course] * formValue.ticketCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints - Math.ceil(points[course] * formValue.ticketCostMultiplier));
        $('#ownItems').val(formValue.ownItems - Math.ceil(points[course] * formValue.ticketCostMultiplier));

        calculate();
    });
    $('.addTicketLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#liveTickets').val(formValue.liveTickets - staminaCost[course] * formValue.ticketCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints + Math.ceil(points[course] * formValue.ticketCostMultiplier));
        $('#ownItems').val(formValue.ownItems + Math.ceil(points[course] * formValue.ticketCostMultiplier));

        calculate();
    });
    $('.subtractLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina + staminaCost[course] * formValue.staminaCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints - points[course] * formValue.staminaCostMultiplier);
        $('#ownItems').val(formValue.ownItems - points[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.addLiveTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#stamina').val(formValue.stamina - staminaCost[course] * formValue.staminaCostMultiplier);
        $('#ownPoints').val(formValue.ownPoints + points[course] * formValue.staminaCostMultiplier);
        $('#ownItems').val(formValue.ownItems + points[course] * formValue.staminaCostMultiplier);

        calculate();
    });
    $('.subtractEventTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#ownItems').val(formValue.ownItems + consumedItemsPerEvent * formValue.inTable.itemsCostMultiplier[course]);
        $('#ownPoints').val(formValue.ownPoints - earnPointsPerEvent * formValue.inTable.itemsCostMultiplier[course]);
        $('#mission').val(formValue.mission + 1);

        calculate();
    });
    $('.addEventTimes').click(function () {
        // eslint-disable-next-line no-invalid-this
        const course = $(this).val();
        const formValue = getFormValue();

        $('#ownItems').val(formValue.ownItems - consumedItemsPerEvent * formValue.inTable.itemsCostMultiplier[course]);
        $('#ownPoints').val(formValue.ownPoints + earnPointsPerEvent * formValue.inTable.itemsCostMultiplier[course]);
        $('#mission').val(formValue.mission - 1);

        calculate();
    });

    // 保存ボタン
    $('#save').click(save);

    // 入力を初期化ボタン
    function defaultInput() {
        $('#datetimeStart').val(dayjs().subtract(15, 'h').format('YYYY-MM-DDT15:00'));
        $('#datetimeEnd').val(dayjs().subtract(15, 'h').add(1, 'w').format('YYYY-MM-DDT20:59'));
        $('#targetEnd').val(30000);
        $('#stamina').val(0);
        $('#liveTickets').val(0);
        $('#ownPoints').val(0);
        $('#ownItems').val(0);
        $('#mission').val(30);
        $('[name="workStaminaCost"][value="20"]').prop('checked', true);
        $('[name="staminaCostMultiplier"][value="1"]').prop('checked', true);
        $('#ticketCostMultiplier').val(10);
        $('[name="itemsCostMultiplier"][value="2"]').prop('checked', true);
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
        $('#stamina').val(savedData.stamina);
        $('#liveTickets').val(savedData.liveTickets);
        $('#ownPoints').val(savedData.ownPoints);
        $('#ownItems').val(savedData.ownItems);
        $('#mission').val(savedData.mission);
        $(`[name="workStaminaCost"][value="${savedData.workStaminaCost}"]`).prop('checked', true);
        $(`[name="staminaCostMultiplier"][value="${savedData.staminaCostMultiplier}"]`).prop('checked', true);
        $('#ticketCostMultiplier').val(savedData.ticketCostMultiplier);
        $(`[name="itemsCostMultiplier"][value="${savedData.itemsCostMultiplier}"]`).prop('checked', true);
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
