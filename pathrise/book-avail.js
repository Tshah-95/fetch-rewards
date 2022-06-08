let axios = require('axios')

let main = async (start, end) => {
    let startDateTime = new Date(start).getTime()
    let endDateTime = new Date(end).getTime()
    let res = await axios('https://storage.googleapis.com/pathrise-app/hiring/availability_10mentors.json')
    let { data } = res
    let mentorList = []

    for (let mentor of data) {
        let { email, availability } = mentor
        let availShort = availability[ "adhoc-30min" ]
        let availLong = availability[ "adhoc-45min" ]
        let addMentor = false

        if (!availLong && !availShort) continue

        if (availShort) {
            availShort.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        }
        if (availLong) {
            availLong.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        }

        for (let timeSlot of availShort) {
            let timeSlotDateTime = new Date(timeSlot).getTime()
            if (timeSlotDateTime >= startDateTime && timeSlotDateTime <= endDateTime) addMentor = true
            break
        }

        for (let timeSlot of availLong) {
            let timeSlotDateTime = new Date(timeSlot).getTime()
            if (timeSlotDateTime >= startDateTime && timeSlotDateTime <= endDateTime) addMentor = true
            break
        }

        if (addMentor) mentorList.push(email)
    }

    console.log(mentorList)
}

main('2022-03-10T13:00:00-08:00', '2022-03-15T09:30:00-08:00')