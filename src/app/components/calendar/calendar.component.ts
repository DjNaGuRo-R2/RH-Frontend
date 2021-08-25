import { DayOffStatusEnum } from './../../enum/dayoff-status-enum';
import { CollaboratorRoleEnum } from './../../enum/collaborator-role-enum';
import { Component, OnInit } from '@angular/core';
import * as moment from 'moment';
import { Collaborator } from 'src/app/model/collaborator';
import { DayOff } from 'src/app/model/dayOff';
import { AuthService } from 'src/app/services/auth.service';
import { UserService } from 'src/app/services/user.service';
import { DayOffTypeEnum } from 'src/app/enum/dayoff-type-enum';
import { DayOffService } from 'src/app/services/day-off.service';
import { NotifierService } from 'angular-notifier';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { HttpErrorResponse } from '@angular/common/http';

// Création d'une interface qui va permettre d'afficher le tableau des jours de congé de chaque employé
interface CollaboratorCalendar extends Collaborator {
  daysOffMonth: (DayOff | null)[];
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent implements OnInit {
  // Mois actuellement visionner qui va permettre de lancer les fonctions permettant de changer le mois affiché
  currentMonth!: number;
  // Mois actuellement visionner affiché dans l'entête du calendrier
  currentMonthLetter!: string;
  // Année actuellement visionner affiché dans l'entête du calendrier
  currentYear = moment().year();
  // Liste de tout les jours du mois actuellement visionner
  daysOffMonth?: string[];
  // Liste des collaborators du département d'un Manager
  collaborators?: Collaborator[];
  collaborator?: Collaborator;
  // Initialisation du calendrier permettant l'affichage des jours de congés de chaques employés
  collaboratorsCalendar: CollaboratorCalendar[] = [];

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private dayOffService: DayOffService,
    private notifierService: NotifierService
  ) {}

  ngOnInit(): void {
    // Récupération des collaborators du département d'un Manager et lancement de la fonction permettant d'initialiser le calendrier
    this.userService.getCollaborator().subscribe((collaborator) => {
      this.collaborator = collaborator;
      if (this.collaborator?.role === CollaboratorRoleEnum.MANAGER) {
        this.userService.getCollaborators().subscribe((collaborators) => {
          this.collaborators = collaborators;
          this.getDaysArrayByMonth(moment().month());
        });
      } else {
        this.getDaysArrayByMonth(moment().month());
      }
    });
  }
  private sendErrorNotification(
    notificationType: NotificationType,
    message: string
  ): void {
    if (message) {
      this.notifierService.notify(notificationType, message);
    } else {
      this.notifierService.notify(
        notificationType,
        'Une erreur est survenue. svp recommencer !'
      );
    }
  }
  // Fonction permettant d'afficher les jours d'un mois donné et traitement de l'affichage des jours de congés de chaque collaborator
  getDaysArrayByMonth(monthChoice: number) {
    this.collaboratorsCalendar = [];
    if (monthChoice < 0) {
      monthChoice = 11;
      this.currentYear -= 1;
    }
    if (monthChoice > 11) {
      monthChoice = 0;
      this.currentYear += 1;
    }
    var daysInMonth = moment([this.currentYear, monthChoice]).daysInMonth();
    var arrDays = [];

    while (daysInMonth) {
      var current = moment([this.currentYear, monthChoice]).date(daysInMonth);
      arrDays.push(current);
      daysInMonth--;
    }
    arrDays.reverse();
    let currentMonthLetter = arrDays[0].locale('fr').format('MMMM');
    this.currentMonthLetter = currentMonthLetter.charAt(0).toUpperCase() + currentMonthLetter.substring(1);
    this.findDayOff(arrDays);
  }

  findDayOff(arrDays: moment.Moment[]) {
    let daysOffMonthFormat: string[] = [];
    this.currentMonth = parseInt(arrDays[0].format('MM'));

    for (const day of arrDays) {
      daysOffMonthFormat.push(day.locale('fr').format('dd \n DD/MM'));
    }
    // Formatage de chaque jours du mois pour l'affichage des jours dans le calendrier
    if (this.collaborators) {
      this.daysOffForDepartment(arrDays);
    } else {
      this.daysOffForCollaborator(arrDays);
    }
    this.daysOffMonth = daysOffMonthFormat;
  }

  daysOffForDepartment(arrDays: moment.Moment[]) {
    if (this.collaborators) {
      // Nous rajoutons à l'interface CollaboratorCalendar chaque collaborator du departement avec un tableau vide de jour de congés
      for (const collaborator of this.collaborators) {
        const collabCalendar: CollaboratorCalendar = {
          ...collaborator,
          daysOffMonth: [],
        };
        // Pour chaque jours du mois si il correspond a un jour de congé d'un collaborator alors nous le rajoutons à sa liste, sinon nous rajoutons une entrée null
        for (const day of arrDays) {
          let dayOffFind = false;
          for (const dayOff of collaborator.daysOffs) {
            if (this.checkDayOff(day, dayOff)) {
              collabCalendar.daysOffMonth.push(dayOff);
              dayOffFind = true;
            }
          }
          if (!dayOffFind) {
            collabCalendar.daysOffMonth.push(null);
          }
        }
        this.collaboratorsCalendar.push(collabCalendar);
      }
    }
  }

  daysOffForCollaborator(arrDays: moment.Moment[]) {
    if (this.collaborator) {
      const collabCalendar: CollaboratorCalendar = {
        ...this.collaborator,
        daysOffMonth: [],
      };
      for (const day of arrDays) {
        let dayOffFind = false;
        for (const dayOff of this.collaborator.daysOffs) {
          if (this.checkDayOff(day, dayOff)) {
            collabCalendar.daysOffMonth.push(dayOff);
            dayOffFind = true;
          }
        }
        if (!dayOffFind) {
          collabCalendar.daysOffMonth.push(null);
        }
      }
      this.collaboratorsCalendar.push(collabCalendar);
    }
  }

  checkDayOff(day: moment.Moment, dayOff: DayOff): boolean {
    let dayEndSplit = parseInt(dayOff.endDate.split('/', 1)[0]);
    let dayStartSplit = parseInt(dayOff.startDate.split('/', 1)[0]);
    let dayOffStartMonth = parseInt(dayOff.startDate.split('/', 2)[1]);
    let dayOffStartYear = parseInt(dayOff.startDate.split('/', 3)[2]);
    let dayOffEndMonth = parseInt(dayOff.endDate.split('/', 2)[1]);
    let dayOffEndYear = parseInt(dayOff.endDate.split('/', 3)[2]);

    let dateStart = moment([
      dayOffStartYear,
      dayOffStartMonth - 1,
      dayStartSplit,
    ]);
    let dateEnd = moment([dayOffEndYear, dayOffEndMonth - 1, dayEndSplit]);
    if (
      day.locale('fr').format('dd') === 'sa' ||
      day.locale('fr').format('dd') === 'di'
    ) {
      return false;
    } else if (day.isBetween(dateStart, dateEnd, 'days', '[]')) {
      return true;
    }
    return false;
  }

  public get DayOffStatusEnum() {
    return DayOffStatusEnum;
  }
  public get DayOffTypeEnum() {
    return DayOffTypeEnum;
  }
  public get CollaboratorRoleEnum() {
    return CollaboratorRoleEnum;
  }
  acceptDayOff(dayOff: DayOff): void {
    let dayOffToChange = this.setDayOffToChange(dayOff,DayOffStatusEnum.VALIDATED)
    this.dayOffService.createDayOff(dayOffToChange).subscribe(response => {
      this.notifierService.notify(
        NotificationType.SUCCESS,
        'Cette demande d\'absence a été validé'
      )
      this.ngOnInit()
    },
    (error:HttpErrorResponse) => {
      this.sendErrorNotification(NotificationType.ERROR, error.error.text)
    })
  }
  refuseDayOff(dayOff: DayOff): void {
    let dayOffToChange = this.setDayOffToChange(dayOff,DayOffStatusEnum.REJECTED)
    this.dayOffService.createDayOff(dayOffToChange).subscribe(response => {
      this.notifierService.notify(
        NotificationType.SUCCESS,
        'Cette demande d\'absence a été refusé'
      )
      this.ngOnInit()
    },
    (error:HttpErrorResponse) => {
      this.sendErrorNotification(NotificationType.ERROR, error.error.text)
    })
  }
  setDayOffToChange(dayOff: DayOff,status: DayOffStatusEnum) : DayOff {
    let dayOffToChange : DayOff = {
      id : dayOff.id,
      requestDate: dayOff.requestDate,
      startDate: dayOff.startDate,
      endDate: dayOff.endDate,
      type: dayOff.type,
      reason : dayOff.reason,
      status : status,
      collaborators: dayOff.collaborators
    }
    return dayOffToChange
  }
  deleteDayOff(dayOff: DayOff): void {
    this.dayOffService.deleteDayOff(dayOff).subscribe(response => {
      this.notifierService.notify(
        NotificationType.SUCCESS,
        'Votre jour de congé a été supprimé'
      )
      this.ngOnInit()
    },
    (error:HttpErrorResponse) => {
      this.sendErrorNotification(NotificationType.ERROR, error.error.text)
    })
  }
}
